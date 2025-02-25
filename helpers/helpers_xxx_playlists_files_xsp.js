﻿'use strict';
//10/04/22

include('..\\helpers-external\\xsp-to-jsp-parser\\xsp_parser.js');

XSP.getQuerySort = function(jsp) {
	let query = this.getQuery(jsp);
	let sort = query.length ? ' ' + this.getSort(jsp) : '';
	return query + sort;
};

XSP.getQuery = function(jsp, bOmitPlaylist = false) {
	const playlist = jsp.playlist;
	const match = playlist.match === 'all' ? 'AND' : 'OR';
	const rules = playlist.rules;
	let query = [];
	for (let rule of rules) {
		const tag = rule.field;
		const op = rule.operator;
		const valueArr = rule.value;
		const fbTag = this.getFbTag(tag);
		if (!fbTag.length || (bOmitPlaylist && fbTag === '#PLAYLIST#')) {continue;} 
		let queryRule = '';
		// Check operators match specific tags
		const textTags = new Set(['GENRE', 'ALBUM', 'ARTIST', 'TITLE', 'COMMENT', 'TRACKNUMBER', '%FILENAME%', '%PATH%', '%RATING%', 'DATE', 'MOOD', 'THEME', 'STYLE', '"ALBUM ARTIST"', '%PLAY_COUNT%', '%LAST_PLAYED%', '#PLAYLIST#']);
		const numTags = new Set(['TRACKNUMBER', '%RATING%', 'DATE', '%PLAY_COUNT%', '%LAST_PLAYED%']);
		const dateTags = new Set(['DATE','%PLAY_COUNT%', '%LAST_PLAYED%']);
		switch (op) {
			case 'is': {
				if (textTags.has(fbTag)){
					queryRule = valueArr.map((val) => {return fbTag + ' IS ' + val;}).join(' OR ');
				}
				break;
			}
			case 'isnot': {
				if (textTags.has(fbTag)){
					queryRule = 'NOT (' + valueArr.map((val) => {return fbTag + ' IS ' + val;}).join(' OR ') +')';
				}
				break;
			}
			case 'contains': {
				if (textTags.has(fbTag)){
					queryRule = valueArr.map((val) => {return fbTag + ' HAS ' + val;}).join(' OR ');
				}
				break;
			}
			case 'doesnotcontain': {
				if (textTags.has(fbTag)){
					queryRule = 'NOT (' + valueArr.map((val) => {return fbTag + ' HAS ' + val;}).join(' OR ') +')';
				}
				break;
			}
			case 'startswith': { // $strstr(%artist%,Wilco) EQUAL 1
				if (textTags.has(fbTag)){
					queryRule = valueArr.map((val) => {return '"$strstr(%' + fbTag.replace(/["%]/g,'') + '%,' + val + ')" EQUAL 1';}).join(' OR ');
				}
				break;
			}
			case 'endswith': { // $strstr($right(%artist%,$len(Wilco)),Wilco) EQUAL 1
				if (textTags.has(fbTag)){
					queryRule = valueArr.map((val) => {return '"$strstr($right(%' + fbTag.replace(/["%]/g,'') + '%,$len(' + val + ')),' + val + ')" EQUAL 1';}).join(' OR ');
				}
				break;
			}
			case 'lessthan': {
				if (numTags.has(fbTag)){
					queryRule = valueArr.map((val) => {return fbTag + ' LESS ' + val;}).join(' OR ');
				}
				break;
			}
			case 'greaterthan': {
				if (numTags.has(fbTag)){
					queryRule = valueArr.map((val) => {return fbTag + ' GREATER ' + val;}).join(' OR ');
				}
				break;
			}
			case 'after': {
				if (dateTags.has(fbTag)){
					queryRule = valueArr.map((val) => {return fbTag + ' AFTER ' + val;}).join(' OR ');
				}
				break;
			}
			case 'before': {
				if (dateTags.has(fbTag)){
					queryRule = valueArr.map((val) => {return fbTag + ' BEFORE ' + val;}).join(' OR ');
				}
				break;
			}
			case 'inthelast': {
				if (dateTags.has(fbTag)){
					queryRule = valueArr.map((val) => {return fbTag + ' DURING LAST ' + val;}).join(' OR ');
				}
				break;
			}
			case 'notinthelast': {
				if (dateTags.has(fbTag)){
					queryRule = 'NOT (' + valueArr.map((val) => {return fbTag + ' DURING LAST ' + val;}).join(' OR ') +')';
				}
				break;
			}
			default: {
				console.log('Operator not recognized: ' + op);
			}
		}
		if (queryRule.length) {query.push(queryRule);}
	}
	query = query_join(query, match) || '';
	return query;
};

XSP.hasQueryPlaylists = function(jsp) {
	const playlist = jsp.playlist;
	const rules = playlist.rules;
	let bPlaylists = false;
	for (let rule of rules) {if (this.getFbTag(rule.field) === '#PLAYLIST#') {bPlaylists = true; break;}}
	return bPlaylists;
};

XSP.getQueryPlaylists = function(jsp) {
	const playlist = jsp.playlist;
	const rules = playlist.rules;
	let query = {is: [], isnot: []};
	for (let rule of rules) {
		const tag = rule.field;
		const op = rule.operator;
		const valueArr = rule.value;
		if (tag !== 'playlist') {console.log('Warning: XSP Playlist with mixed standard queries and playlists as sources.'); continue;} 
		switch (op) {
			case 'is': {
				query.is = query.is.concat(valueArr);
				break;
			}
			case 'isnot': {
				query.isnot = query.isnot.concat(valueArr);
				break;
			}
			default: {
				console.log('Operator not recognized: ' + op);
			}
		}
	}
	return query;
};

XSP.getSort = function(jsp) {
	const playlist = jsp.playlist;
	let sort = '';
	if (playlist.hasOwnProperty('order')) {
		const order = playlist.order[0];
		const keys = Object.keys(order);
		const direction = keys && keys.length ? keys[0] : null;
		if (direction) {
			const tag = order[direction];
			switch (direction) {
				case 'ascending': {sort = 'SORT ASCENDING BY'; break;}
				case 'descending': {sort = 'SORT DESCENDING BY'; break;}
				default: {console.log('Direction not recognized: ' + direction + (jsp.playlist.hasOwnProperty('name') && jsp.playlist.name.length ? ' (playlist \'' + jsp.playlist.name + '\')' : '')); break;}
			}
			if (sort.length) {
				let fbTag = this.getFbTag(tag);
				if (fbTag.length) {sort += ' ' + (!fbTag.match(/[%$]/g) ? '%' + fbTag + '%' : fbTag);}
			}
		}
	}
	return sort;
};

XSP.getFbTag = function(tag) {
	let fbTag = '';
	switch (tag) {
		// As is
		case 'genre':
		case 'album':
		case 'artist':
		case 'title':
		case 'comment':
		case 'tracknumber': {fbTag = tag; break;}
		// Need %
		case 'filename':
		case 'path': {fbTag = '%' + tag + '%'; break;}
		// Are the same
		case 'rating':
		case 'userrating': {fbTag = '%rating%'; break;} // Requires foo playcount
		// Idem
		case 'year':
		case 'time': {fbTag = 'date'; break;}
		// Others...
		case 'moods': {fbTag = 'mood'; break;}
		case 'themes': {fbTag = 'theme'; break;}
		case 'styles': {fbTag = 'style'; break;}
		case 'albumartist': {fbTag = 'album artist'; break;}
		case 'playcount': {fbTag = '%play_count%'; break;} // Requires foo playcount
		case 'lastplayed': {fbTag = '%last_played%'; break;} // Requires foo playcount
		// Special Tags
		case 'playlist': {fbTag = '#playlist#'; break;} // Does not work in foobar queries
		case 'random': {fbTag = '$rand()'; break;} // Does not work in foobar queries
		default: {
			console.log('Tag not recognized: ' + tag);
		}
	}
	return (fbTag.indexOf('$') !== -1 ? fbTag : fbTag.toUpperCase());
};

XSP.getTag = function(fbTag) {
	let tag = '';
	let fbTaglw = fbTag.toLowerCase().replace(/["%]/g,''); // removes % in any case to match all possibilities
	switch (fbTaglw) {
		case 'genre':
		case 'album':
		case 'artist':
		case 'title':
		case 'comment':
		case 'tracknumber':
		case 'rating': // Requires foo playcount, userrating has no correspondence
		case 'filename':
		case 'path': {tag = fbTaglw; break;}
		case 'year':
		case 'date': {tag = 'year'; break;}
		// time has no correspondence
		// Others...
		case 'mood': {tag = 'moods'; break;}
		case 'theme': {tag = 'themes'; break;}
		case 'style': {tag = 'styles'; break;}
		case '"album artist"': {tag = 'albumartist'; break;}
		case 'play_count': {tag = 'playcount'; break;} // Requires foo playcount
		case 'last_played': {tag = 'lastplayed'; break;} // Requires foo playcount
		// Special tags
		case '#playlist#': {tag = 'playlist'; break;} // Does not work in foobar queries
		case '$rand()': {tag = 'random'; break;} // Does not work in foobar queries
		default: {
			console.log('Tag not recognized: ' + fbTag);
		}
	}
	return tag;
};

XSP.getMatch = function(jsp) {
	const playlist = jsp.playlist;
	return  playlist.match === 'all' ? 'AND' : 'OR';
};

XSP.getLimit = function(jsp) {
	const playlist = jsp.playlist;
	const limit = playlist.hasOwnProperty('limit') && playlist.limit !== void(0) ? Number(playlist.limit) : null;
	return  limit || Infinity; // 0 retrieves All
};

XSP.getOrder = function(queryOrSort) {
	let order = [{}]; // TODO [] ?
	let direction = '';
	let fbTag = '';
	if (queryOrSort.match(/ *SORT.*$/)) {	
		if (queryOrSort.match(/ *SORT BY .*$/)) {direction = 'ascending'; fbTag = queryOrSort.match(/(?: *SORT BY )(.*$)/)[1];}
		else if (queryOrSort.match(/ *SORT DESCENDING BY .*$/)) {direction = 'descending'; fbTag = queryOrSort.match(/(?: *SORT DESCENDING BY )(.*$)/)[1];}
		else if (queryOrSort.match(/ *SORT ASCENDING BY .*$/)) {direction = 'ascending'; fbTag = queryOrSort.match(/(?: *SORT ASCENDING BY )(.*$)/)[1];}
		else {console.log('Sorting not recognized: ' + queryOrSort);}
	}
	if (direction.length && fbTag.length) {
		let tag = this.getTag(fbTag);
		if (tag.length) {order[0][direction] = tag;}
	}
	return order;
};

XSP.getRules = function(querySort) {
	const bDebug = false;
	let rules = [];
	let match = '';
	let query = stripSort(querySort); // Ensure there is no sort clause
	if (query.length) {
		// const searches = [
			// {regexp: /\) AND /g, split: [')','AND']},
			// {regexp: /AND \(/g, split: ['AND', '(']},
			// {regexp: /\) AND \(/g, split: [')','AND', '(']},
			// {regexp: /\) AND NOT /g, split: [')','AND NOT']},
			// {regexp: / AND NOT \(/g, split: ['AND NOT','(']},
			// {regexp: /\) AND NOT \(/g, split: [')','AND NOT','(']},
			// {regexp: / AND NOT /g, split: 'AND NOT'},
			// {regexp: / AND /g, split: 'AND'},
			// {regexp: / OR NOT /g, split: 'OR NOT'},
			// {regexp: / OR /g, split: 'OR'},
			// {regexp: / NOT /g, split: 'NOT'},
			// {regexp: /^\(/g, split: '('},
			// {regexp: /\)$/g, split: ')'}
		// ];
		const searches = [
			{regexp: /\) AND /g, split: [')','AND']},
			{regexp: /AND \(/g, split: ['AND', '(']},
			{regexp: /\) AND \(/g, split: [')','AND', '(']},
			// {regexp: /\) AND NOT /g, split: [')','AND NOT']},
			// {regexp: / AND NOT \(/g, split: ['AND NOT','(']},
			// {regexp: /\) AND NOT \(/g, split: [')','AND NOT','(']},
			// {regexp: / AND NOT /g, split: 'AND NOT'},
			{regexp: / AND /g, split: 'AND'},
			// {regexp: / OR NOT /g, split: 'OR NOT'},
			{regexp: / OR /g, split: 'OR'},
			// {regexp: / NOT /g, split: 'NOT'},
			{regexp: / *NOT \(/g, split: ['NOT','(']},
			{regexp: /^\(/g, split: '('},
			{regexp: /\)$/g, split: ')'}
		];
		const opposites = new Map([['is','isnot'],['contains','doesnotcontain'],['inthelast','notinthelast']]);
		let querySplit = [query];
		for (let search of searches) {
			querySplit = recursiveSplit(querySplit, search.regexp, search.split).flat(Infinity);
		}
		
		let idx = [];
		querySplit.forEach((q, i) => {
			if (q === '(' || q === ')') {idx.push(i);}
		});
		idx = idx.reduce(function(result, value, index, array) {
			if (index % 2 === 0) {result.push(array.slice(index, index + 2));}
			return result;
		}, []);
		
		let querySplitCopy = [];
		if (idx.length) {
			querySplit.forEach((q, j) => {
				if (j < idx[0][0]) {querySplitCopy.push(q);}
				else if (j === idx[0][0]) {querySplitCopy.push([]);}
				else if (j >= idx[0][1]) {idx.splice(0,1);}
				else {querySplitCopy[querySplitCopy.length - 1].push(q);}
			});
		} else {querySplitCopy = querySplit;}
		match = rules.length === 1 || querySplitCopy.every((item) => {return item !== 'OR' && item !== 'OR NOT';}) ? 'all' : 'one';
		let prevOp = '';
		rules = querySplitCopy.map((query) => {return this.getRule(query);});
		let rulesV2 = rules.map((rule) => {
			if (Array.isArray(rule)) {
				return rule.map((r) => {return r.field || r;});
			} else {return rule.field || rule;}
		});
		let rulesV3 = [];
		const opSet = new Set(['is','contains','startswith','endswith','lessthan','greaterthan','inthelast']);
		rules.forEach((rule, i) => {
			if (Array.isArray(rule)) {
				let field = '';
				let operator = '';
				if (prevOp === 'NOT') { // Then also i !== 0
					if (rule.every((q) => {
						if (!field.length && q.field) {field = q.field;}
						if (!operator.length && q.operator) {operator = q.operator;}
						if (typeof q === 'object') {return q.field === field && q.operator === operator && opSet.has(operator);}
						else {return q === 'AND';}
					})) {if (opposites.has(operator)) {rulesV3.push(opposites.get(operator));}}
				} else {
					if (rule.every((q) => {
						if (!field.length && q.field) {field = q.field;}
						if (!operator.length && q.operator) {operator = q.operator;}
						if (typeof q === 'object') {return q.field === field && q.operator === operator && opSet.has(operator);}
						else {return q === 'OR';}
					})) {rulesV3.push(operator);}
					else if (i === 0 && rule.every((q) => {
						if (typeof q === 'object') {return opSet.has(q.operator);}
						else {return q === 'AND';}
					})) {rulesV3 = rulesV3.concat(rule.filter((q) => {return q !== 'AND';}).map((q) => {return q.operator;}));}
					else if (prevOp === 'AND' && rule.every((q) => {
						if (typeof q === 'object') {return opSet.has(q.operator);}
						else {return q === 'AND';}
					})) {rulesV3 = rulesV3.concat(rule.filter((q) => {return q !== 'AND';}).map((q) => {return q.operator;}));}
				}
				prevOp = '';
			} else {
				prevOp = '';
				if (opSet.has(rule.operator)) {rulesV3.push(rule.operator);}
				else if (rule === 'AND') {prevOp = 'AND';}
				else if (rule === 'NOT') {prevOp = 'NOT';}
				else {rulesV3.push(rule);}
			}
		});
		let rulesV4 = [];
		prevOp = '';
		rules.forEach((rule, i) => {
			if (Array.isArray(rule)) {
				let field = '';
				let operator = '';
				let value = [];
				if (prevOp === 'NOT') { // Then also i !== 0
					if (rule.every((q) => {
						if (!field.length && q.field) {field = q.field;}
						if (!operator.length && q.operator) {operator = q.operator;}
						if (q.value && q.value.length) {value = value.concat(...q.value);}
						if (typeof q === 'object') {return q.field === field && q.operator === operator && opSet.has(operator);}
						else {return q === 'AND';}
					})) {if (opposites.has(operator)) {rulesV4.push({operator: opposites.get(operator), field, value});}}
				} else {
					if (rule.every((q) => {
						if (!field.length && q.field) {field = q.field;}
						if (!operator.length && q.operator) {operator = q.operator;}
						if (q.value && q.value.length) {value = value.concat(...q.value);}
						if (typeof q === 'object') {return q.field === field && q.operator === operator && opSet.has(operator);}
						else {return q === 'OR';}
					})) {rulesV4.push({operator, field, value});}
					else if (i === 0 && rule.every((q) => {
						if (typeof q === 'object') {return opSet.has(q.operator);}
						else {return q === 'AND';}
					})) {rulesV4 = rulesV4.concat(rule.filter((q) => {return q !== 'AND';}));}
					else if (prevOp === 'AND' && rule.every((q) => {
						if (typeof q === 'object') {return opSet.has(q.operator);}
						else {return q === 'AND';}
					})) {rulesV4 = rulesV4.concat(rule.filter((q) => {return q !== 'AND';}));}
				}
				prevOp = '';
			} else {
				prevOp = '';
				if (opSet.has(rule.operator)) {rulesV4.push(rule);}
				else if (rule === 'AND') {prevOp = 'AND';}
				else if (rule === 'NOT') {prevOp = 'NOT';}
				else {rulesV4.push(rule);}
			}
		});
		// let rulesV5 = [];
		// const v4len = rulesV4.length;
		// if (v4len === 1) {rulesV5.push(rule);}
		// rulesV4.forEach((rule, i) => {
			// let bDone = false;
			// let j = i - 1;
			// if (j >= 0) {
				// const prevRule = rulesV4[j];
				// if (prevRule.field == rule.field && prevRule.operator == rule.operator) {
					// const newRule = rulesV4[i];
					// newRule.value = [...new Set(newRule.value.concat(prevRule.value))];
					// rulesV5.push(newRule);
					// bDone = true;
				// } else {
					// if (j === 0) {rulesV5.push(prevRule);}
					// rulesV5.push(rule);
				// }
			// }
		// });
		// match = rulesV5.length === 1 || rulesV5.every((item) => {return item !== 'OR' && item !== 'OR NOT';}) ? 'all' : 'one';
		// rulesV5 = rulesV5.filter((rule) => {return typeof rule === 'object';});
		if (bDebug) {
			console.log(match);
			console.log('Split query in groups:\n', querySplitCopy);
			console.log('Retrieved rules:\n', rules);
			console.log('Tags:\n', rulesV2);
			console.log('Values:\n', rulesV3);
			console.log('Final rules after discarding and grouping:\n', rulesV4);
			// console.log('Rules V5:\n', rulesV5);
		}
		rules = rulesV4;
	}
	return {rules, match};
};

XSP.getRule = function(query) {
	let rule = {operator: '', field: '', value: []};
	if (Array.isArray(query)) {rule = query.map((q) => {return this.getRule(q);});}
	else {
		if (new Set(['AND','AND NOT','OR','NOT']).has(query)) {rule = query;}
		else {
			switch (true) {
				case query.match(/NOT [ #"%.-<>\w]* IS [ #,"%.-<>\w]*/g) !== null: {
					rule.operator = 'isnot';
					[ , rule.field, rule.value] = query.match(/NOT ([ #"%.-<>\w]*) IS ([ #,"%.-<>\w]*)/);
					break;
				}
				case query.match(/[ #"%.-<>\w]* IS [ #,"%.-<>\w]*/g) !== null: {
					rule.operator = 'is';
					[ , rule.field, rule.value] = query.match(/([ #"%.-<>\w]*) IS ([ #,"%.-<>\w]*)/);
					break;
				}
				case query.match(/NOT [ #"%.-<>\w]* HAS [ #,"%.-<>\w]*/g) !== null: {
					rule.operator = 'doesnotcontain';
					[ , rule.field, rule.value] = query.match(/NOT ([ #"%.-<>\w]*) HAS ([ #,"%.-<>\w]*)/);
					break;
				}
				case query.match(/[ #"%.-<>\w]* HAS [ #,"%.-<>\w]*/g) !== null: {
					rule.operator = 'contains';
					[ , rule.field, rule.value] = query.match(/([ #"%.-<>\w]*) HAS ([ #,"%.-<>\w]*)/);
					break;
				}
				case query.match(/\$strstr\([ %.-<>\w]*\) EQUAL 1/g) !== null: { // $strstr(%artist%,Wilco) EQUAL 1
					rule.operator = 'startswith';
					[ , rule.field, rule.value] = query.match(/\$strstr\(([ %.-<>\w]*),([ ,#"%.-\w]*)/);
					break;
				}
				case query.match(/\$strstr\(\$right\([ %.-<>\w]*,\$len\([ #,"%.-<>\w]*\)\)[ #,"%.-<>\w]*\) EQUAL 1/g) !== null: { // $strstr($right(%artist%,$len(Wilco)),Wilco) EQUAL 1
					rule.operator = 'endswith';
					[ , rule.field, rule.value] = query.match(/\$strstr\(\$right\(([ %.-<>\w]*),\$len\(([ #,"%.-<>\w]*)/);
					break;
				}
				case query.match(/[ %.-<>\w]* LESS [ \d]*/g) !== null: {
					rule.operator = 'lessthan';
					[ , rule.field, rule.value] = query.match(/([ %.-<>\w]*) LESS ([ \d]*)/);
					break;
				}
				case query.match(/[ %.-<>\w]* GREATER [ \d]*/g) !== null: {
					rule.operator = 'greaterthan';
					[ , rule.field, rule.value] = query.match(/([ %.-<>\w]*) GREATER ([ \d]*)/);
					break;
				}
				case query.match(/[ %.-<>\w]* AFTER [ \d]*/g) !== null: {
					rule.operator = 'after';
					[ , rule.field, rule.value] = query.match(/([ ",%.-\w]*) AFTER ([ \d]*)/);
					break;
				}
				case query.match(/[ %.-<>\w]* BEFORE [ \d]*/g) !== null: {
					rule.operator = 'before';
					[ , rule.field, rule.value] = query.match(/([ ",%.-\w]*) BEFORE ([ \d]*)/);
					break;
				}
				case query.match(/NOT [ %.-<>\w]* DURING LAST [ \w]*/g) !== null: {
					rule.operator = 'notinthelast';
					[ , rule.field, rule.value] = query.match(/NOT ([ ",%.-\w]*) DURING LAST ([ \w]*)/);
					break;
				}
				case query.match(/[ %.-<>\w]* DURING LAST [ \w]*/g) !== null: {
					rule.operator = 'inthelast';
					[ , rule.field, rule.value] = query.match(/([ ",%.-\w]*) DURING LAST ([ \w]*)/);
					break;
				}
				default: {
					console.log('Operator not recognized: ' + query);
				}
			}
			if (rule.value.length) {rule.value = [rule.value.trim().replace(/^"|"$/g,'')];}
			if (rule.field.length) {rule.field = this.getTag(rule.field);}
		}
	}
	return rule;
};

if (!query_join) {
	const logicDic = ['and', 'or', 'and not', 'or not', 'AND', 'OR', 'AND NOT', 'OR NOT'];
	// Joins an array of queries with 'SetLogic' between them: AND (NOT) / OR (NOT)
	var query_join = function(queryArray, setLogic) {
			if (logicDic.indexOf(setLogic) === -1) {
				console.log('query_join(): setLogic (' + setLogic + ') is wrong.');
				return '';
			}
			let arrayLength = queryArray.length;
			// Wrong array
			let isArray = Object.prototype.toString.call(queryArray) === '[object Array]' ? 1 : 0; //queryArray
			if (!isArray || typeof queryArray === 'undefined' || queryArray === null || arrayLength === null || arrayLength === 0) {
				console.log('query_join(): queryArray [' + queryArray + '] was null, empty or not an array.');
				return ''; //Array was null or not an array
			}
			
			let query = '';
			let i = 0;
			while (i < arrayLength) {
				if (i === 0) {
					query += (arrayLength > 1 ? '(' : '') + queryArray[i] + (arrayLength > 1 ? ')' : '');
				} else {
					query += ' ' + setLogic + ' (' + queryArray[i] + ')';
				}
				i++;
			}
			return query;
	};
}

if (!stripSort) {
	var stripSort = function(query) {
		let queryNoSort = query;
		if (query.indexOf('SORT') !== -1) {
			if (query.indexOf(' SORT BY ') !== -1) {queryNoSort = query.split(' SORT BY ')[0];}
			else if (query.indexOf(' SORT DESCENDING BY ') !== -1) {queryNoSort = query.split(' SORT DESCENDING BY ')[0];}
			else if (query.indexOf(' SORT ASCENDING BY ') !== -1) {queryNoSort = query.split(' SORT ASCENDING BY ')[0];}
		}
		return queryNoSort;
	};
}

function recursiveSplit(arr, regExp, split) {
	let copy;
	if (Array.isArray(arr)) {
		copy = arr.map((newArr) => {return recursiveSplit(newArr, regExp, split);});
	} else {
		copy = arr.split(regExp).map((item, i, ori) => {return i === ori.length - 1 ? (item.length ? [item] : []) : (item.length ? [item, split] : [split]);}).flat(Infinity);
	}
	return copy;
}