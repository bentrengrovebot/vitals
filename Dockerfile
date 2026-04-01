FROM node:20-slim

WORKDIR /app

# Install openssl for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Generate Prisma client and build frontend
RUN npx prisma generate && npm run build

# Expose port
EXPOSE 3000

# Start
CMD ["node", "server/index.js"]
# trigger rebuild
