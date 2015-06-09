// browserfy
(function() {
	var __tx_headers = {'persistent': true};
	var __delays = {};
	var MsgTransactionManager = {};
	// returns the onmessage() handler for the broker that supports the transaction on it
	MsgTransactionManager.getBorkerOnMessageHandler = function() {
		return (
		function (message) {
			var o = JSON.parse(message.body);
			var id = o.id;
			var dealy = __delays[id];
			if (dealy) {
				var callback = dealy[0];
				var timer = dealy[1];
				callback(o.content);
				clearTimeout(timer);
				delete __delays[id];
			}
		});
	};
	// returns a function that start the transaction, the start function returns a transaction object
	// the transaction supports the following events:
	// 1. onConfirmed()
	// 1. onSuccess()
	// 2. onError()
	MsgTransactionManager.getTxStart = function(broker, idGenerator, outgoing, incoming) {
		return (
		function (method, content, timeoutMS) {
			var tx = {};
			idGenerator.request(function(id) {
				tx.id = id;
				var o = { method: method, id: id, content: content , ack_destination: incoming};
				var timer = setTimeout(function () {
					delete __delays[id];
					if (typeof tx.onError === 'function') tx.onError('message transaction timeout');
				}, timeoutMS);
				__delays[id] = [function (cont) { if (typeof tx.onSuccess === 'function') tx.onSuccess(cont); }, timer];
				broker.send(outgoing, __tx_headers, JSON.stringify(o), function(receipt) {
					tx.receipt = receipt;
					if (typeof tx.onConfirmed === 'function') tx.onConfirmed();
				});
			});
			return tx;			
		});
	};
	// returns a function that acknowledge the transaction
	MsgTransactionManager.getTxAck = function (broker, message) {
		return (
			function (ackContent, onAckConfirm) {
				var o = JSON.parse(message.body);
				var ack_o = { method: o.method, id: o.id, content: ackContent };
				broker.send(o.ack_destination, __tx_headers, JSON.stringify(ack_o), onAckConfirm);
			});
	};

	if (typeof exports !== "undefined" && exports !== null) {	// run inside node.js
		module.exports = MsgTransactionManager;
	}
	if (typeof window !== "undefined" && window !== null) {	// run inside browser
		window.MsgTransactionManager = MsgTransactionManager;
	}
}).call(this);
