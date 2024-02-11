# Blockchain

## Installation code
This code requires [Node.js](https://nodejs.org/en/download/) 7+ (which comes with
[npm](http://npmjs.com))

Installation requires [Git](https://git-scm.com).  From the command line:
```bash
# Download repo
git clone https://github.com/hposton/blockchain

# Enter repository
cd blockchain

# Install dependencies
npm install

# Generate public/private keys
mkdir keys
cd keys
openssl genrsa -out private-key.pem 2048
openssl rsa -in private-key.pem -pubout -out public-key.pem
cd ..

# Run the app
npm start
```

## Getting Started
This code uses vorpal as a CLI.  To see available commands, type help into the vorpal interface

## Learn More
This code is used in my Build a Blockchain from Scratch offered by Eduonix.
