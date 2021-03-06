var _ = require('lodash');
var async = require('async');

var Runtime = require('../Runtime');
var Response = require('../Response');
var Transaction = require('../Transaction');
var ResourceNotFound = require('../errors/ResourceNotFound');

function initTransaction(resource, res) {
	var assignProperty = 'jsonapify.transaction';
	var transaction = _.get(res, assignProperty);
	if (!transaction) {
		var response = new Response(res);
		transaction = new Transaction(resource, response);
		_.set(res, assignProperty, transaction);
	}
	return transaction;
}

function parseChain(chain) {
	if (!_.isArray(chain)) chain = [chain];
	var chunks = _.chunk(chain, 2);
	return _.map(chunks, function(chunk) {
		return {
			resource: Runtime.getResource(chunk[0]),
			selector: chunk[1],
		};
	});
}

function resolveSelector(selector, req, parent) {
	if (_.isFunction(selector))
		selector = { _id: selector };
	return (function iterate(object, result) {
		_.each(object, function(value, key) {
			if (_.isPlainObject(value) && !_.isEmpty(value)) {
				var subobj = {};
				iterate(value, subobj);
				_.set(result, key, subobj);
			} else if (_.isFunction(value)) {
				_.set(result, key, value(req, parent));
			} else {
				_.set(result, key, value);
			}
		});
		return result;
	})(selector, {});
}

function applyChain(transaction, chain, req, callback) {
	return async.reduce(chain, null, function(parent, link, next) {
		var resource = link.resource;
		var resview = resource.view(transaction);
		var filter = resolveSelector(link.selector, req, parent);
		resview.findOne(filter, function(err, object) {
			if (err) return next(err);
			if (!object) return next(new ResourceNotFound(resource, filter));
			next(null, object);
		});
	}, callback);
}

exports.parseChain = parseChain;
exports.initTransaction = initTransaction;
exports.resolveSelector = resolveSelector;
exports.applyChain = applyChain;
