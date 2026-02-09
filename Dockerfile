# Use the official Playwright image which comes with Node.js and browsers installed
# This is critical for reliable browser automation
FROM mcr.microsoft.com/playwright:v1.50.0-jammy

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
# We use 'npm ci' for a clean, deterministic install in CI/CD/Docker environments
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# exposer worker port if needed (though workers usually just pull from queue)
# EXPOSE 3000

# Start the worker
CMD ["npm", "run", "start:worker"]
