FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_DIR=/opt/model \
    MODEL_NAME=multilingual-e5-small \
    ONNX_FILE=onnx/model_quint8_avx2.onnx \
    ORT_THREADS=2 \
    MAX_LENGTH=512

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Baixa o modelo e lista os arquivos ONNX disponíveis no log do build
ARG MODEL_REPO=intfloat/multilingual-e5-small
RUN python -c "from huggingface_hub import snapshot_download; \
snapshot_download(repo_id='${MODEL_REPO}', local_dir='/opt/model', \
allow_patterns=['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','sentencepiece.bpe.model','onnx/*'])" \
 && ls -la /opt/model/onnx

COPY . .

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]