const Block = require("./Block.js");
const Transaction = require("./Transaction.js").Transaction;
const Output = require("./Transaction.js").Output;
const crypto = require("crypto");
//const signer = require(("nacl-signature"));
class Blockchain {
	constructor() {
		this.blockchain = [];
		this.transactionPool = [];
		this.unusedOutputs = [];
		this.blockSize = 16;
		this.blockReward = 25;
		this.nextID = 0;
		this.publicKeys = new Map();

		// Difficulty targets
		this.updateInterval = 1;
		this.difficulty = 1;
		this.targetRate = 60;

		// Initiate blockchain with Genesis block
		let timestamp = Date.now();
		let nonce = this.mine(0,0,timestamp,0);
		let hash = this.calculateBlockHash(0,0,timestamp,0,nonce);
		let genesisBlock = new Block(0,0,timestamp,0,hash,nonce,[]);
		this.blockchain.push(genesisBlock);
	}

	get() {
		return this.blockchain;
	}

	get latestBlock() {
		return this.blockchain[this.blockchain.length - 1];
	}

	// Difficulty Update
	updateDifficulty() {
		let index = this.blockchain.length-1;
		let delta = this.blockchain[index].timestamp - this.blockchain[index-this.updateInterval].timestamp;
		let averageRate = delta / this.updateInterval;
		let ratio = averageRate / this.targetRate;
		this.difficulty /= ratio;
	}

	// Block Creation
	createNextBlock() {
		let transactions = this.selectTransactions();
		let transactionRoot = this.buildMerkleTree(transactions,this.blockSize);

		let index = this.latestBlock.index + 1;
		let prevHash = this.latestBlock.hash;
		let timestamp = new Date().getTime();
		let nonce = this.mine(index,prevHash,timestamp,transactionRoot);
		if (nonce < 0) {	// Other node found block first
			this.updateState(this.latestBlock);
			return this.latestBlock;
		}
		let hash = this.calculateBlockHash(
				index,
				prevHash,
				timestamp,
				transactionRoot,
				nonce);

		const newBlock = new Block(
			index,
			prevHash,
			timestamp,
			transactionRoot,
			hash,
			nonce,
			transactions);

		// Add new block to chain
		this.blockchain.push(newBlock);

		let state = this.updateState(newBlock,this.unusedOutputs,this.transactionPool,this.nextID);
		this.transactionPool = state.transactionPool;
		this.unusedOutputs = state.unusedOutputs;
		this.nextID = state.nextID;

		// Perform difficulty update
		if (((index+1) % this.updateInterval) == 0) {
			this.updateDifficulty();
		}

		//return newBlock;
	}

	updateState(block,unusedOutputs,transactionPool,nxtID) {
		let nextID = nxtID+1;
		for (let i = 0; i < block.transactions.length; i++) {
			let trans = block.transactions[i];
			if (trans.id > nextID) {
				nextID = trans.id + 1;
			}
			let ind = transactionPool.indexOf(trans);
			transactionPool.splice(ind,1);
			for (let i = 0; i < trans.inputs.length; i++) {
				let ind = unusedOutputs.indexOf(trans.inputs[i]);
				unusedOutputs.splice(ind,1);
			}
			trans.outputs.forEach(
				output => unusedOutputs.push(output)
			);
		}
		nextID = nextID;
		return {transactionPool,unusedOutputs,nextID};
	}

	selectTransactions() {	// Assumes that transaction pool is sorted
		let transactionPool = this.transactionPool;

		// Automatically add block reward transaction
		let transactions = [transactionPool[0]];
		transactionPool.shift();
		let count = 1; 
		while (count < this.blockSize && transactionPool.length > 0) {
			let transaction = transactionPool[0];
			if (this.isValidTransaction(transaction)) {
				transactions.push(transaction);
				count += 1;
			}
			transactionPool.shift();
		}
		// TODO: Store used transactions in temp in case other node found block first
		return transactions;
	}

	isValidTransaction(transaction) {
		let i = 0;
		let inputValue = 0;
		// Check for double spend and valid signatures
		if (!transaction.inputs) {
			return false;
		}
		for (i = 0; i < transaction.inputs.length; i++) {
			let input = transaction.inputs[i];
			let index = this.unusedOutputs.indexOf(input); 
			if (index < 0) {
				return false;
			}
			if (!this.isValidSignature(input)) {
				return false;
			}
			inputValue += input.value;
		}
		// Check to ensure that input and output values match
		let outputValue = transaction.fee; // Include fee in cost of transaction
		for (i = 0; i < transaction.outputs.length; i++) {
			outputValue += transaction.outputs[i].value;
		}
		if (inputValue != outputValue) {
			return false;
		}
		return true;
	}

	isValidSignature(input) {
		let publicKey = this.publicKeys.get(input.address);
		let signature = input.signature;
		let data = [input.address,input.value].toString();
		const verifier = crypto.createVerify("RSA-SHA256");
		verifier.write(data);
		verifier.end();
		const valid = verifier.verify(publicKey,signature,"hex");
		return valid;
	}

	buildMerkleTree(transactions,num) {
		if (num == 1) {
			return crypto.createHash("sha256").update(JSON.stringify(transactions[0])).digest("hex");
		} else {
			let newNum = Math.floor(num/2);
			let firstHalf = transactions.slice(0,newNum);
			let firstHash = this.buildMerkleTree(firstHalf,newNum);
			if (transactions.length > newNum) {
				let secondHalf = transactions.slice(newNum,transactions.length);
				let secondHash = this.buildMerkleTree(secondHalf,newNum);
				return crypto.createHash("sha256").update(firstHash+secondHash).digest("hex");
			} else {
				return firstHash;
			}
		}
	}

	// Hash Functions
	calcHash(input) {
		return crypto.createHash("sha256").update(input).digest("hex");
	}

	createTransactionHash(id,inputs,outputs) {
		let input = JSON.stringify([id,inputs,outputs]);
		return this.calcHash(input);
	}
	createOutputHash(output) {
		let input = JSON.stringify(output);
		return this.calcHash(input);
	}

	// Transaction Creation
	buildTransaction(inputs,outputs,fee,publicKey) {
		let id = this.nextID;
		this.nextID += 1;
		let hash = this.createTransactionHash(id,inputs,outputs);
		const trans = new Transaction(id,hash,inputs,outputs,fee);
		if (this.isValidTransaction(trans,publicKey)) {
			return trans;
		} else {
			return false;
		}
	}

	createRewardTransaction(addr) {
        	const out = new Output(addr,this.blockReward);
        	let id = this.nextID;
		this.nextID += 1;
        	let hash = this.createTransactionHash(id,[],[out]);
	        return new Transaction(id,hash,[],[out],0);
	}

	insertTransaction(trans) {
		for (let i = 0; i < this.transactionPool.length; i++) {
			if (trans.fee > this.transactionPool[i].fee) {
				this.transactionPool.splice(i,0,trans);
				return;
			}
		}
		this.transactionPool.push(trans);
	}

	// Proof of Work Consensus

	mine(index,previousHash,timestamp,transactionRoot) {
		let nonce = 0;
		let hash = this.calculateBlockHash(index,previousHash,timestamp,transactionRoot,nonce);
		while (!this.checkHashDifficulty(hash)) { 
			if (index > 0) {
				let externalBlock = this.checkExternalBlock(index);
				if (externalBlock) {
					nonce = -1;
					return nonce;
				}
			}
			nonce += 1;
			hash = this.calculateBlockHash(index,previousHash,timestamp,transactionRoot,nonce);
		}
		return nonce;
	}

	calculateBlockHash(index,prevHash,timestamp,data,nonce) {
		let input = JSON.stringify([index,prevHash,timestamp,data,nonce]);
		return this.calcHash(input);
	}

	calculateHashOfBlock(block) {
		return this.calculateBlockHash(block.index,block.previousHash,block.timestamp,block.data,block.nonce);
	}

	checkHashDifficulty(hash) {
		let target = Math.ceil(Math.pow(2,256-this.difficulty));
		if (parseInt(hash,16) > target) {
			return false;
		} else {
			return true;
		}
	}


	checkExternalBlock(index) {
		if (index  < this.latestBlock.index) {
			return true;
		} else {
			return false;
		}
	}




	// Blockchain Updates
	validateBlock(prevBlock,block,unusedOutputs) {
		let hash = this.calculateHashOfBlock(block);
		console.log("Hash calculated");
		let merkleRoot = this.buildMerkleTree(block.transactions,this.blockSize);
		console.log("Merkle calculated");
		if (block.index != prevBlock.index + 1) {
			console.log("Index incorrect");
			return false;
		} else if (block.previousHash != prevBlock.hash) {
			console.log("Prev hash incorrect");
			return false;
		} else if (block.hash != hash) {
			console.log("Hash incorrect");
			return false;
		} else if(!this.checkHashDifficulty(hash)) {
			console.log("Difficulty incorrect");
			return false;
		} else if(block.data != merkleRoot) {
			console.log("Merkle incorrect");
			return false;
		}
		console.log("Initial arguments valid");
		for (let i = 1; i < block.transactions.length; i++) {
			if (!this.isValidTransaction(block.transactions[i])) {
				console.log("Transaction "+i+" invalid.");
				return false;
			}
		}
		return true;
	}








	getExternalBlock() {
		return null;
		// TODO: Read block from socket
	}
	addExternalBlock(block) {
		if (this.validateBlock(this.latestBlock,block)) {
			this.blockchain.push(block);
			return true;
		} else {
			return false;
		}
	}

	fullTransactionPool(chain) {
		let pool = []
		for (let i = 0; i < chain.length; i++) {
			pool = pool.concat(chain[i].transactions);
		}
		return pool;
	}

	mergeTransactionPools(newchain) {
		let oldPool = this.fullTransactionPool(this.blockchain);
		let newPool = this.fullTransactionPool(newchain);
		let unsent = []
		for (let i = 0; i < oldPool.length; i++) {
			let trans = oldPool[i];
			ind = newPool.indexOf(trans);
			if (ind < 0) {
				unsent.push(trans);
				newPool.push(trans);
			}
		}
		return [newPool,unsent];
	}

	// TODO: Optimize to only look at divergent blocks
	isValidChain(newchain,transactionPool) { 
		let unusedOutputs = [];
		let nextID = 0;
		console.log("Validating chain");
		//if (JSON.stringify(newchain[0]) !== JSON.stringify(this.blockchain[0])) {
		//	return false; // Invalid genesis block
		//}
		for (let i = 1; i < newchain.length; i++) {
			console.log("Validating block "+i);
			if (!this.validateBlock(newchain[i-1],newchain[i],unusedOutputs)) {
				return false;
			}
			let state = this.updateState(newchain[i],unusedOutputs,transactionPool,nextID);
			unusedOutputs = state.unusedOutputs;
			transactionPool = state.transactionPool;
			nextID = state.nextID;
		}
		console.log("Chain valid.");
		this.unusedOutputs = unusedOutputs;
		return true
	}
	replaceChain(newchain) {	// Longest Chain Rule
		if (newchain.length > this.blockchain.length) {
			let pools = this.mergeTransactionPools(newchain);
			let transactionPool = pools[0];
			let unsent = pools[1];
			if (this.isValidChain(newchain,transactionPool)) {
				this.blockchain = newchain;
				return [true,unsent];
			}
			return [false,unsent];
		}
	}
}

module.exports = Blockchain;

