/**
 * Raw callgraph
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

module.exports = function (data) {
	return JSON.stringify(data.callgraph, null, 2);
};
