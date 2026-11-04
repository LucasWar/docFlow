import os
from pathlib import Path
from typing import Literal

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoTokenizer

MODEL_DIR = os.getenv("MODEL_DIR", "/opt/model")
MODEL_NAME = os.getenv("MODEL_NAME", "multilingual-e5-small")
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "256"))
THREADS = int(os.getenv("ORT_THREADS", "2"))


def find_onnx() -> str:
    base = Path(MODEL_DIR)
    for name in ("onnx/model.onnx", "onnx/model_quantized.onnx"):
        if (base / name).exists():
            return str(base / name)
    found = sorted((base / "onnx").glob("*.onnx"))
    if not found:
        raise FileNotFoundError(f"Nenhum .onnx em {base / 'onnx'}")
    return str(found[0])


options = ort.SessionOptions()
options.intra_op_num_threads = THREADS
options.inter_op_num_threads = 1
options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)

ONNX_PATH = find_onnx()
print(f"Usando modelo ONNX: {ONNX_PATH}", flush=True)

session = ort.InferenceSession(
    ONNX_PATH, sess_options=options, providers=["CPUExecutionProvider"]
)
input_names = {item.name for item in session.get_inputs()}

app = FastAPI(title="Local Embeddings", version="2.0.0")


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=32)
    kind: Literal["query", "passage"]


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "onnx": ONNX_PATH}


@app.post("/embeddings")
def embeddings(request: EmbeddingRequest):
    if any(not t.strip() for t in request.texts):
        raise HTTPException(status_code=422, detail="Os textos não podem estar vazios.")

    texts = [f"{request.kind}: {t.strip()}" for t in request.texts]
    encoded = tokenizer(
        texts, padding=True, truncation=True, max_length=MAX_LENGTH, return_tensors="np"
    )

    inputs = {
        "input_ids": np.asarray(encoded["input_ids"], dtype=np.int64),
        "attention_mask": np.asarray(encoded["attention_mask"], dtype=np.int64),
    }
    if "token_type_ids" in input_names:
        inputs["token_type_ids"] = np.zeros_like(inputs["input_ids"])
    inputs = {k: v for k, v in inputs.items() if k in input_names}

    token_vectors = session.run(None, inputs)[0]

    mask = np.expand_dims(encoded["attention_mask"].astype(np.float32), axis=-1)
    vectors = (token_vectors * mask).sum(axis=1) / np.maximum(mask.sum(axis=1), 1e-9)
    vectors = vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-12)

    return {
        "model": MODEL_NAME,
        "dimensions": int(vectors.shape[1]),
        "embeddings": vectors.tolist(),
    }