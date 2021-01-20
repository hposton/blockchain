class Block {
	constructor(index,previousHash,timestamp,data,hash,nonce,transactions) {
		// Block Header
		this.index = index;
		this.previousHash = previousHash;
		this.timestamp = timestamp;
		this.data = data;
		this.nonce = nonce;

		// Not included in Block Header
		this.hash = hash;

		// Block Body
		this.transactions = transactions;
	}
}

module.exports = Block;

