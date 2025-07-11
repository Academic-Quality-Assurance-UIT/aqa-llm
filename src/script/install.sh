curl -fsSL https://ollama.com/install.sh | sh

export OLLAMA_HOST="0.0.0.0:11434"
export OLLAMA_ORIGINS="*"
ollama serve &

curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update \
  && sudo apt install ngrok

  ngrok config add-authtoken TOKEN

  ngrok http http://localhost:11434