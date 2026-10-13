# Use a lightweight Node.js 20 image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Install OpenSSL (required by Prisma on Alpine Linux)
RUN apk add --no-cache openssl

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Generate Prisma client and compile TypeScript to JavaScript
RUN npx prisma generate
RUN npm run build

# Expose the port the Express server runs on
EXPOSE 5000

# Start the server
CMD ["npm", "start"]