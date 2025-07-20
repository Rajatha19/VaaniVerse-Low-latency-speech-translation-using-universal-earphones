# Use the official Node.js image as base
FROM node:18-slim AS builder

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Install Python dependencies
RUN pip3 install -r requirements.txt

# Set up models
RUN mkdir -p models && \
    cd models && \
    git clone https://github.com/AI4Bharat/IndicTrans2 indictrans2 && \
    cd indictrans2 && \
    bash setup.sh && \
    cd ../..

# Download TTS models
RUN python3 -c "from TTS.api import TTS; TTS().download_model('tts_models/en/ljspeech/tacotron2-DDC'); TTS().download_model('tts_models/hi/fairseq/vits'); TTS().download_model('tts_models/multilingual/multi-dataset/xtts_v2')"

# Build the Next.js application
RUN npm run build

# Production image
FROM node:18-slim AS runner

# Install Python, pip and ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/models ./models
COPY --from=builder /app/requirements.txt ./

# Install Python dependencies
RUN pip3 install -r requirements.txt

# Set environment variables
ENV NODE_ENV=production
ENV INDICTRANS2_MODEL_DIR=./models/indictrans2

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
