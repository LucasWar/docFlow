
FROM --platform=linux/amd64 python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_DIR=/opt/model \
    ORT_THREADS=2 \
    MAX_LENGTH=256

WORKDIR /app

# Instala as dependências
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Baixa os arquivos necessários do modelo ONNX ARM64
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', local_dir='/opt/model', allow_patterns=['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','sentencepiece.bpe.model','onnx/model_qint8_arm64.onnx'])"

# Copia os arquivos do serviço para /app
COPY . .

# Executa com usuário sem privilégios
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app /opt/model

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
