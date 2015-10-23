/**
 * Raw output. Meant for saving full information about a trace, so that you can
 *  manipulate and display it later.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

module.exports = function (data) {
	return JSON.stringify(data, null, 0);
};
module.exports.isRaw = true;
