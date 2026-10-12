
import os

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoTokenizer

MODEL_DIR = os.getenv("MODEL_DIR", "/opt/model")
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "256"))
THREADS = int(os.getenv("ORT_THREADS", "2"))

# Evita que cada operação crie threads em excesso.
options = ort.SessionOptions()
options.intra_op_num_threads = THREADS
options.inter_op_num_threads = 1
options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_DIR,
    local_files_only=True,
)

session = ort.InferenceSession(
    f"{MODEL_DIR}/onnx/model_qint8_arm64.onnx",
    sess_options=options,
    providers=["CPUExecutionProvider"],
)

input_names = {item.name for item in session.get_inputs()}

app = FastAPI(title="Local Embeddings", version="1.0.0")


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=32)


@app.get("/health")
def health():
    return {"status": "ok", "model": "minilm-quantized"}


@app.post("/embeddings")
def embeddings(request: EmbeddingRequest):
    if any(not text.strip() for text in request.texts):
        raise HTTPException(
            status_code=422,
            detail="Os textos não podem estar vazios.",
        )

    encoded = tokenizer(
        request.texts,
        padding=True,
        truncation=True,
        max_length=MAX_LENGTH,
        return_tensors="np",
    )

    inputs = {
        "input_ids": np.asarray(encoded["input_ids"], dtype=np.int64),
        "attention_mask": np.asarray(encoded["attention_mask"], dtype=np.int64),
        "token_type_ids": np.asarray(
            encoded.get("token_type_ids", np.zeros_like(encoded["input_ids"])),
            dtype=np.int64,
        ),
    }

    outputs = session.run(None, inputs)
    token_vectors = outputs[0]

    # Mean pooling: ignora tokens de padding.
    mask = encoded["attention_mask"].astype(np.float32)
    mask = np.expand_dims(mask, axis=-1)

    vectors = (token_vectors * mask).sum(axis=1)
    denominator = np.maximum(mask.sum(axis=1), 1e-9)
    vectors = vectors / denominator

    # Normalização L2.
    norms = np.maximum(
        np.linalg.norm(vectors, axis=1, keepdims=True),
        1e-12,
    )
    vectors = vectors / norms

    return {
        "model": "paraphrase-multilingual-MiniLM-L12-v2",
        "dimensions": int(vectors.shape[1]),
        "embeddings": vectors.tolist(),
    }
