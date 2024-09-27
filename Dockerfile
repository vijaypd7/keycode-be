FROM node:16

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Expose port
EXPOSE 3000

# # Command to run the app
# CMD [ "npm", "start" ]
