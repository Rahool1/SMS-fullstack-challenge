FROM node

# App directory
WORKDIR /home/node/app

# Install app dependencies
COPY package*.json ./

RUN npm install

# App source
COPY . /home/node/app

CMD [ "npm", "start" ]