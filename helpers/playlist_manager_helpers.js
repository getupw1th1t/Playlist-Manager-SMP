﻿'use strict';
//15/05/22

include(fb.ComponentPath + 'docs\\Codepages.js');
include('helpers_xxx.js');
include('helpers_xxx_properties.js');
include('helpers_xxx_file.js');
include('helpers_xxx_prototypes.js');
include('helpers_xxx_clipboard.js');
include('helpers_xxx_playlists_files.js');
include('..\\main\\remove_duplicates.js');

function oPlaylist(id, path, name = void(0), extension = void(0), size = '?', fileSize = 0, bLocked = false, bAutoPlaylist = false, queryObj = {query: '', sort: '', bSortForced: false}, category = '', tags = [], trackTags = [], limit = 0, duration = -1) {
	if (typeof extension === 'undefined') {extension = utils.SplitFilePath(path)[2];}
	if (typeof name === 'undefined') {name = utils.SplitFilePath(path)[1];}
	this.id = id;
	this.name = name;
	this.nameId = (id) ? name + id : name;
	this.extension = extension.toLowerCase();
	this.path = path;
	this.size = size;
	this.fileSize = fileSize;
	this.isLocked = bLocked;
	this.isAutoPlaylist = bAutoPlaylist;
	this.query = queryObj['query'];
	this.sort = queryObj['sort'];
	this.bSortForced = queryObj['bSortForced'];
	this.category = category;
	this.tags = isArrayStrings(tags) ? tags : [];
	this.trackTags = isArray(trackTags) ? trackTags : [];
	this.limit = Number.isFinite(limit) ? limit : 0;
	this.duration = Number.isFinite(duration) ? duration : -1;
}

function loadPlaylistsFromFolder(folderPath = getPropertyByKey(properties, 'playlistPath', prefix)) {
	const playlistPathArray = getFiles(folderPath, loadablePlaylistFormats); // Workaround for Win7 bug on extension matching with utils.Glob()
	const playlistPathArrayLength = playlistPathArray.length;
	let playlistArray = [];
	for (let i = 0; i < playlistPathArrayLength; i++) {
		const file = playlistPathArray[i];
		if (!_isFile(file)) {continue;} // In some rare cases a file may have been deleted while updating the others leading to a crash otherwise...
		const extension = '.' + file.split('.').pop().toLowerCase();
		let name = '';
		let uuid = '';
		let bLocked = false;
		let category = '';
		let tags = [];
		let trackTags = [];
		let size = null;
		let queryObj = null;
		let limit = null;
		let duration = null;
		const fileSize = utils.GetFileSize(file);
		if (extension === '.m3u8' || extension === '.m3u') { // Schema does not apply for foobar native playlist format
			let text = _open(file).split(/\r\n|\n\r|\n|\r/);
			if (typeof text !== 'undefined' && text.length >= 1) {
				// Safe checks to ensure proper UTF-8 and codepage detection
				const codePage = checkCodePage(text, extension);
				if (codePage !== -1) {text = _open(file, codePage).split(/\r\n|\n\r|\n|\r/);}
				let commentsText = text.filter(function(e) {return e.startsWith('#');});
				if (typeof commentsText !== 'undefined' && commentsText.length >= 1) { // Use playlist info
					let lines = commentsText.length;
					let lineText = '';
					let j = 0;
					let iFound = 0;
					while (j < lines) {
						let temp = '';
						lineText = commentsText[j];
						if (lineText.startsWith('#PLAYLIST:')) {
							iFound++;
							name = lineText.split(':').slice(1).join(':'); // Name may contain ':' too!
						}
						if (lineText.startsWith('#UUID:')) {
							iFound++;
							uuid = lineText.split(':').slice(1).join(':');
						}
						if (lineText.startsWith('#LOCKED:')) {
							iFound++;
							bLocked = (lineText.split(':')[1] === 'true');
						}
						if (lineText.startsWith('#CATEGORY:')) {
							iFound++;
							category = lineText.split(':').slice(1).join(':');
						}
						if (lineText.startsWith('#TAGS:')) {
							iFound++;
							tags = lineText.split(':').slice(1).join(':').split(';').filter(Boolean); // All values separated by ; as an array
						}
						if (lineText.startsWith('#TRACKTAGS:')) {
							iFound++;
							temp = lineText.split(':').slice(1).join(':');
							trackTags = temp.length ? JSON.parse(lineText.split(':').slice(1).join(':')) : []; // Array of objects
						}
						if (lineText.startsWith('#PLAYLISTSIZE:')) {
							iFound++;
							size = Number(lineText.split(':')[1]);
						}
						if (lineText.startsWith('#DURATION:')) {
							iFound++;
							duration = Number(lineText.split(':')[1]);
						}
						if (iFound === 8) {break;}
						j++;
					}
				}
			}			
			if (size === null) { // Or count tracks
				const filteredText = text.filter(function(e) {return !e.startsWith('#');});
				size = filteredText.length;
			}
		} else if (extension === '.fpl') { // AddLocations is async so it doesn't work...
			// Nothing
			// Locked according to manager config
		} else if (extension === '.pls') {
			let text = _open(file).split(/\r\n|\n\r|\n|\r/);
			if (typeof text !== 'undefined' && text.length >= 1) {
				let sizeText = text.filter(function(e) {return e.startsWith('NumberOfEntries');});
				if (typeof sizeText !== 'undefined' && sizeText.length >= 1) { // Use playlist info
					size = Number(sizeText[0].split('=')[1]);
				}
			}
			if (size === null) { // Or count tracks
				let fileText = text.filter(function(e) {return e.startsWith('File');});
				size = fileText.length;
			}	
		} else if (extension === '.strm') {
			let text = _open(file).split(/\r\n|\n\r|\n|\r/);
			if (typeof text !== 'undefined') {
				size = text.filter(Boolean).length;
				if (size > 1) {fb.ShowPopupMessage('.strm playlist can\'t contain multiple items: ' + file, window.Name);}
				bLocked = true; // Always locked by default
			}
		} else if (extension === '.xspf') {
			let text = _open(file);
			if (typeof text !== 'undefined') {
				const codePage = checkCodePage(text, extension);
				if (codePage !== -1) {text = _open(file, codePage);}
				const xmldom = XSPF.XMLfromString(text);
				const jspf = XSPF.toJSPF(xmldom, false);
				if (jspf.hasOwnProperty('playlist') && jspf.playlist) {
					const jPls = jspf.playlist;
					name = jPls.hasOwnProperty('title') && jPls.title ? jPls.title : '';
					if (jPls.hasOwnProperty('meta') && Array.isArray(jPls.meta) && jPls.meta.length) {
						let bLockedFound = false;
						for (let metaData of jPls.meta) {
							if (metaData.hasOwnProperty('uuid')) {uuid = metaData.uuid ? metaData.uuid : '';}
							if (metaData.hasOwnProperty('locked')) {bLocked = metaData.locked && metaData.locked.length ? metaData.locked === 'true' : true; bLockedFound = true;}
							if (metaData.hasOwnProperty('category')) {category = metaData.category ? metaData.category : '';}
							if (metaData.hasOwnProperty('tags')) {tags = metaData.tags ? metaData.tags.split(';') : [];}
							if (metaData.hasOwnProperty('trackTags')) {trackTags = metaData.trackTags ? JSON.parse(metaData.trackTags) : [];}
							if (metaData.hasOwnProperty('playlistSize')) {size = typeof metaData.playlistSize !== 'undefined' ? Number(metaData.playlistSize) : null;}
							if (metaData.hasOwnProperty('duration')) {duration = typeof metaData.playlistSize !== 'undefined' ? Number(metaData.duration) : null;}
						}
						if (!bLockedFound) {bLocked = true;} // Locked by default if meta not present
					}
					if (size === null) {size = jPls.hasOwnProperty('track') && jPls.track ? jPls.track.length : null;} // Prefer playlist info over track count
					else if (jPls.hasOwnProperty('track') && jPls.track && size !== jPls.track.length) {fb.ShowPopupMessage('.xspf playlist size mismatch: ' + file + '\nReported size (' + size +') is not equal to track count (' + jPls.track.length +')', window.Name);}
				}
			}
		} else if (extension === '.xsp') {
			let text = _open(file);
			if (typeof text !== 'undefined') {
				const codePage = checkCodePage(text, extension);
				if (codePage !== -1) {text = _open(file, codePage);}
				const xmldom = XSP.XMLfromString(text);
				const jsp = XSP.toJSP(xmldom, false);
				if (jsp.hasOwnProperty('playlist') && jsp.playlist) {
					const jPls = jsp.playlist;
					name = jPls.hasOwnProperty('name') && jPls.name ? jPls.name : '';
					queryObj = {query: XSP.getQuery(jsp), sort: XSP.getSort(jsp), bSortForced: false};
					bLocked = true;
					limit = jPls.hasOwnProperty('limit') && jPls.limit ? jPls.limit : 0;
				}
			}
		}
		playlistArray[i] = new oPlaylist(uuid, file, name.length ? name : void(0), extension, size !== null ? size : void(0), fileSize, bLocked, void(0), queryObj ? queryObj : void(0), category.length ? category : void(0), isArrayStrings(tags) ? tags : void(0), isArray(trackTags) ? trackTags : void(0), Number.isFinite(limit) ? limit : void(0), Number.isFinite(duration) ? duration : void(0));
	}
	return playlistArray;
}

function setTrackTags(trackTags, list, z) {
	let bDone = false;
	const oldTags = list.data[z].trackTags && list.data[z].trackTags.length ? JSON.stringify(list.data[z].trackTags) : '';
	const newTags = trackTags && trackTags.length ? JSON.stringify(trackTags) : '';
	if (oldTags !== newTags) { // Compares objects
		if (list.data[z].isAutoPlaylist || list.data[z].extension === '.fpl' || list.data[z].extension === '.xsp') {
			list.editData(list.data[z], {trackTags});
			list.update(true, true);
			list.filter();
			bDone = true;
		} else {
			const name = list.data[z].name;
			const path = list.data[z].path;
			if (_isFile(path)) {
				// Backup
				const backPath = path + '.back';
				_copyFile(path, backPath);
				delayAutoUpdate();
				let reason = -1;
				if (list.data[z].extension === '.m3u' || list.data[z].extension === '.m3u8') {[bDone, reason] = editTextFile(path,'#TRACKTAGS:' + oldTags,'#TRACKTAGS:' + newTags, list.bBOM);}
				else if (list.data[z].extension === '.xspf') {[bDone, reason] = editTextFile(path,'<meta rel="tags">' + oldTags,'<meta rel="tags">' + newTags, list.bBOM);}
				if (!bDone && reason === 1) {
					bDone = rewriteHeader(list, z);
					if (bDone) {setTag(trackTags, list, z); return;}
				}
				if (!bDone) {
					fb.ShowPopupMessage('Error changing track tag(s) on playlist file: ' + name + '\nTag(s): ' + trackTags + '\n\nPath: ' + path + '\n\nRestoring backup...', window.Name);
					_renameFile(backPath, path); // Restore backup in case something goes wrong
					console.log('Playlist manager: Restoring backup...');
				} else {
					if (_isFile(backPath)) {_deleteFile(backPath);}
					list.editData(list.data[z], {trackTags});
					list.update(true , true);
					list.filter();
				}
			} else {
				fb.ShowPopupMessage('Playlist file does not exist: ' + old_name + '\nPath: ' + path, window.Name);
			}
		}
	}
	return bDone;
}

function setTag(tags, list, z) {
	let bDone = false;
	if (! new Set(tags).isEqual(new Set(list.data[z].tags))) { // Compares arrays
		if (list.data[z].isAutoPlaylist || list.data[z].extension === '.fpl' || list.data[z].extension === '.xsp') {
			list.editData(list.data[z], {tags});
			list.update(true, true);
			const tagState = [...new Set(list.tagState.concat(tags)).intersection(new Set(list.tags()))];
			list.filter({tagState});
			bDone = true;
		} else {
			const name = list.data[z].name;
			const path = list.data[z].path;
			if (_isFile(path)) {
				// Backup
				const backPath = path + '.back';
				_copyFile(path, backPath);
				delayAutoUpdate();
				let reason = -1;
				if (list.data[z].extension === '.m3u' || list.data[z].extension === '.m3u8') {[bDone, reason] = editTextFile(path,'#TAGS:' + list.data[z].tags.join(';'),'#TAGS:' + tags.join(';'), list.bBOM);}
				else if (list.data[z].extension === '.xspf') {[bDone, reason] = editTextFile(path,'<meta rel="tags">' + list.data[z].tags.join(';'),'<meta rel="tags">' + tags.join(';'), list.bBOM);}
				if (!bDone && reason === 1) {
					bDone = rewriteHeader(list, z);
					if (bDone) {setTag(tags, list, z); return;}
				}
				if (!bDone) {
					fb.ShowPopupMessage('Error changing tag(s) on playlist file: ' + name + '\nTag(s): ' + tags + '\n\nPath: ' + path + '\n\nRestoring backup...', window.Name);
					_renameFile(backPath, path); // Restore backup in case something goes wrong
					console.log('Playlist manager: Restoring backup...');
				} else {
					if (_isFile(backPath)) {_deleteFile(backPath);}
					list.editData(list.data[z], {tags});
					list.update(true , true);
					const tagState = [...new Set(list.tagState.concat(tags)).intersection(new Set(list.tags()))];
					list.filter({tagState});
				}
			} else {
				fb.ShowPopupMessage('Playlist file does not exist: ' + name + '\nPath: ' + path, window.Name);
			}
		}
	}
	return bDone;
}

function setCategory(category, list, z) {
	let bDone = false;
	if (list.data[z].category !== category) {
		if (list.data[z].isAutoPlaylist || list.data[z].extension === '.fpl' || list.data[z].extension === '.xsp') {
			list.editData(list.data[z], {category});
			// Add new category to current view! (otherwise it gets filtered)
			// Easy way: intersect current view + new one with refreshed list
			list.update(true, true);
			const categoryState = [...new Set(list.categoryState.concat([category])).intersection(new Set(list.categories()))];
			list.filter({categoryState});
			bDone = true;
		} else {
			const name = list.data[z].name;
			const path = list.data[z].path;
			if (_isFile(path)) {
				// Backup
				const backPath = path + '.back';
				_copyFile(path, backPath);
				delayAutoUpdate();
				let reason = -1;
				if (list.data[z].extension === '.m3u' || list.data[z].extension === '.m3u8') {[bDone, reason] = editTextFile(path,'#CATEGORY:' + list.data[z].category,'#CATEGORY:' + category, list.bBOM);}
				else if (list.data[z].extension === '.xspf') {[bDone, reason] = editTextFile(path,'<meta rel="category">' + list.data[z].category,'<meta rel="category">' + category, list.bBOM);}
				if (!bDone && reason === 1) {
					bDone = rewriteHeader(list, z); 
					if (bDone) {setCategory(category, list, z); return;}
				}
				if (!bDone) {
					fb.ShowPopupMessage('Error changing category on playlist file: ' + name + '\nCategory: ' + category + '\n\nPath: ' + path + '\n\nRestoring backup...', window.Name);
					_renameFile(backPath, path); // Restore backup in case something goes wrong
					console.log('Playlist manager: Restoring backup...');
				} else {
					if (_isFile(backPath)) {_deleteFile(backPath);}
					list.editData(list.data[z], {category});
					list.update(true, true);
					// Add new category to current view! (otherwise it gets filtered)
					// Easy way: intersect current view + new one with refreshed list
					const categoryState = [...new Set(list.categoryState.concat([category])).intersection(new Set(list.categories()))];
					list.filter({categoryState});
				}
			} else {
				fb.ShowPopupMessage('Playlist file does not exist: ' + name + '\nPath: ' + path, window.Name);
			}
		}
	}
	return bDone;
}

function switchLock(list, z) {
	let bDone = false;
	const boolText = list.data[z].isLocked ? ['true','false'] : ['false','true'];
	if (list.data[z].isAutoPlaylist || list.data[z].extension === '.fpl' || list.data[z].extension === '.strm' || list.data[z].extension === '.xsp') {
		list.editData(list.data[z], {isLocked: !list.data[z].isLocked});
		list.update(true, true);
		list.filter();
		bDone = true;
	} else {
		const name = list.data[z].name;
		const path = list.data[z].path;
		if (_isFile(path)) {
			// Backup
			const backPath = path + '.back';
			_copyFile(path, backPath);
			delayAutoUpdate();
			let reason = -1;
			if (list.data[z].extension === '.m3u' || list.data[z].extension === '.m3u8') {[bDone, reason] = editTextFile(path,'#LOCKED:' + boolText[0],'#LOCKED:' + boolText[1], list.bBOM);}
			else if (list.data[z].extension === '.xspf') {[bDone, reason] = editTextFile(path,'<meta rel="locked">' + boolText[0],'<meta rel="locked">' + boolText[1], list.bBOM);}
			if (!bDone && reason === 1) {
				bDone = rewriteHeader(list, z);
				if (bDone) {switchLock(list, z); return;}
			}
			if (!bDone) {
				fb.ShowPopupMessage('Error changing lock status on playlist file: ' + name + '\n\nPath: ' + path + '\n\nRestoring backup...', window.Name);
				_renameFile(backPath, path); // Restore backup in case something goes wrong
				console.log('Playlist manager: Restoring backup...');
			} else {
				if (_isFile(backPath)) {_deleteFile(backPath);}
				list.editData(list.data[z], {isLocked: !list.data[z].isLocked});
				list.update(true, true);
				list.filter();
			}
		} else {
			fb.ShowPopupMessage('Playlist file does not exist: ' + name + '\nPath: ' + path, window.Name);
		}
	}
	return bDone;
}

function rewriteHeader(list, z) {
	let bDone = false;
	if (list.data[z].extension === '.m3u' || list.data[z].extension === '.m3u8') {
		let fileText = _open(list.data[z].path);
		const codePage = checkCodePage(fileText, list.data[z].extension);
		if (codePage !== -1) {fileText = _open(list.data[z].path, codePage); if (!fileText.length) {return false;}}
		fileText = fileText.split(/\r\n|\n\r|\n|\r/);
		const idx = fileText.findIndex((line) => {return line.startsWith('#EXTINF:') || !line.startsWith('#');});
		if (idx !== -1) {
			const newHeader = [
				'#EXTM3U',
				'#EXTENC:UTF-8',
				'#PLAYLIST:' + list.data[z].name,
				'#UUID:' + list.data[z].id,
				'#LOCKED:' + list.data[z].isLocked,
				'#CATEGORY:' + list.data[z].category,
				'#TAGS:' + (isArrayStrings(list.data[z].tags) ? list.data[z].tags.join(';') : ''),
				'#TRACKTAGS:' + (isArray(list.data[z].trackTags) ? JSON.stringify(list.data[z].trackTags) : ''),
				'#PLAYLISTSIZE:' + list.data[z].size,
			];
			fileText.splice(0, idx, ...newHeader);
			bDone = _save(list.data[z].path, fileText.join('\r\n'));
		}
	} else if (list.data[z].extension === '.xspf') {
		let fileText = _open(list.data[z].path);
		const codePage = checkCodePage(fileText, list.data[z].extension);
		if (codePage !== -1) {fileText = _open(list.data[z].path, codePage); if (!fileText.length) {return false;}}
		fileText = fileText.split(/\r\n|\n\r|\n|\r/);
		const idx = fileText.findIndex((line) => {return line.indexOf('<trackList>') !== -1;});
			if (idx >= 2) {
			const newHeader = [
				'	<title>' + list.data[z].name + '</title>',
				'	<meta rel="uuid">' + list.data[z].id + '</meta>',
				'	<meta rel="locked">' + list.data[z].isLocked + '</meta>',
				'	<meta rel="category">' + list.data[z].category + '</meta>',
				'	<meta rel="tags">' + (isArrayStrings(list.data[z].tags) ? list.data[z].tags.join(';') : '') + '</meta>',
				'	<meta rel="trackTags">' + (isArray(list.data[z].trackTags) ? JSON.stringify(list.data[z].trackTags) : '') + '</meta>',
				'	<meta rel="playlistSize">' + list.data[z].size + '</meta>',
			];
			fileText.splice(2, idx - 2, ...newHeader);
			bDone = _save(list.data[z].path, fileText.join('\r\n'));
		}
	}
	return bDone;
}

function convertToRelPaths(list, z) {
	let bDone = false;
	let answer = WshShell.Popup('Force relative paths to the playlist path, stripping all but the filenames.\nCan be manually undone (look at recycle bin). Are you sure?', 0, window.Name, popup.question + popup.yes_no);
	if (answer === popup.no) {return bDone;}
	const delay = setInterval(delayAutoUpdate, list.autoUpdateDelayTimer);
	const pls = list.data[z];
	const playlistPath = pls.path;
	const paths = getFilePathsFromPlaylist(playlistPath);
	const relPaths = paths.map((path) => {return '.\\' + path.split('\\').pop();});
	const codePage = checkCodePage(_open(playlistPath), pls.extension);
	let file = _open(playlistPath, codePage !== -1 ? codePage : 0);
	if (file.length) {
		if (pls.extension === '.xspf') { // Paths must be URI encoded...
			paths.forEach((path, i) => {file = file.replace(encodeURI(path.replace(/\\/g,'/')), encodeURI(relPaths[i].replace(/\\/g,'/')));});
		} else {
			paths.forEach((path, i) => {file = file.replace(path, relPaths[i]);});
		}
		let bDeleted = false;
		if (_isFile(playlistPath)) {
			bDeleted = _recycleFile(playlistPath, true);
		} else {bDeleted = true;}
		if (bDeleted) {
			bDone = _save(playlistPath, file, list.bBOM); // No BOM
			if (!bDone) {
				fb.ShowPopupMessage('Playlist generation failed while writing file \'' + playlistPath + '\'.', window.Name);
				_restoreFile(playlistPath); // Since it failed we need to restore the original playlist back to the folder!
				return bDone;
			}
			list.editData(pls, {
				fileSize: utils.GetFileSize(playlistPath),
			});
			console.log('Playlist Manager: done.');
			list.update(true, true); // We have already updated data before only for the variables changed
			list.filter();
		} else {
			fb.ShowPopupMessage('Playlist generation failed when overwriting original playlist file \'' + playlistPath + '\'. May be locked.', window.Name);
			return bDone;
		}
	}
	clearInterval(delay);
	return bDone;
}

function cloneAsAutoPls(list, z) { // May be used only to copy an Auto-Playlist
	let bDone = false;
	const pls = list.data[z];
	const playlistName = pls.name + ' (copy ' + list.dataAll.reduce((count, iPls) => {if (iPls.name.startsWith(pls.name + ' (copy ')) {count++;} return count;}, 0)+ ')';
	const objectPlaylist = clone(pls);
	objectPlaylist.name = playlistName;
	bDone = list.addAutoplaylist(objectPlaylist) ? true : false;
	if (bDone) {console.log('Playlist Manager: cloning ' + playlistName + ' done.');} else {console.log('Playlist Manager: Error duplicating playlist'); return false;}
	return bDone;
}

function cloneAsStandardPls(list, z, remDupl = []) { // May be used to copy an Auto-Playlist to standard playlist or simply to clone a standard one
	let bDone = false;
	const pls = list.data[z];
	const playlistName = pls.name + ' (std copy ' + list.dataAll.reduce((count, iPls) => {if (iPls.name.startsWith(pls.name + ' (std copy ')) {count++;} return count;}, 0)+ ')';
	const playlistPath = list.playlistsPath + sanitize(playlistName) + list.playlistsExtension;
	const idx = getPlaylistIndexArray(list.data[z].nameId);
	if (idx && idx.length === 1) { // Already loaded? Duplicate it
		plman.ActivePlaylist = idx[0];
		const newIdx = plman.DuplicatePlaylist(plman.ActivePlaylist, plman.GetPlaylistName(plman.ActivePlaylist).replace(pls.name, playlistName));
		if (newIdx !== -1) {plman.ActivePlaylist = newIdx;}
		else {console.log('Error duplicating playlist'); return false;}
	} else if (idx && idx.length === 0) { // Not loaded? Load, duplicate it
		list.loadPlaylist(z);
		const newIdx = plman.DuplicatePlaylist(plman.ActivePlaylist, plman.GetPlaylistName(plman.ActivePlaylist).replace(pls.name, playlistName));
		plman.RemovePlaylistSwitch(plman.ActivePlaylist);
		if (newIdx !== -1) {plman.ActivePlaylist = newIdx - 1;}
		else {console.log('Error duplicating playlist'); return false;}
	} else {
		fb.ShowPopupMessage('You can not have duplicated playlist names within foobar: ' + pls.name + '\n' + 'Please delete all playlist with that name first; you may leave one. Then try loading the playlist again.', window.Name);
		return false;
	}
	if (remDupl && remDupl.length && do_remove_duplicates) {do_remove_duplicates(null, null, remDupl);}
	const objectPlaylist = list.add(false); // Create playlist from active playlist
	bDone = objectPlaylist && _isFile(objectPlaylist.path); // Debug popups are already handled at prev line
	if (bDone) {
		if (list.properties.bOpenOnExport[1]) {_explorer(objectPlaylist.path);}
		console.log('Playlist Manager: cloning ' + playlistName + ' done.');
	}
	return bDone;
}

function clonePlaylistInUI(list, z) {
	let bDone = false;
	const pls = list.data[z];
	const bUI = pls.extension === '.ui';
	// Create new playlist and check paths
	const handleList = !bUI ? getHandlesFromPlaylist(pls.path, list.playlistsPath, true) : getHandleFromUIPlaylists([pls.nameId], false); // Omit not found
	if (handleList && handleList.Count) {
		const playlistName = pls.name + ' (copy ' + list.dataAll.reduce((count, iPls) => {if (iPls.name.startsWith(pls.name + ' (copy ')) {count++;} return count;}, 0) + ')';
		const idx = plman.CreatePlaylist(plman.PlaylistCount, playlistName);
		if (idx !== -1) {
			plman.ActivePlaylist = idx;
			plman.InsertPlaylistItems(plman.ActivePlaylist, 0, handleList);
			bDone = true;
		}
		if (bDone) {console.log('Playlist Manager: cloning ' + playlistName + ' done.');}
	}
	return bDone;
}

function clonePlaylistFile(list, z, ext) {
	if (ext === '.ui') {return clonePlaylistInUI(list, z);}
	let bDone = false;
	const pls = list.data[z];
	const bUI = pls.extension === '.ui';
	const playlistName = pls.name + ' (copy ' + list.dataAll.reduce((count, iPls) => {if (iPls.name.startsWith(pls.name + ' (copy ')) {count++;} return count;}, 0) + ')';
	const playlistPath = list.playlistsPath + sanitize(playlistName) + ext;
	// Create new playlist and check paths
	const handleList = !bUI ? getHandlesFromPlaylist(pls.path, list.playlistsPath, true) : getHandleFromUIPlaylists([pls.nameId], false); // Omit not found
	const paths = !bUI ? getFilePathsFromPlaylist(pls.path) : fb.TitleFormat('%path%').EvalWithMetadbs(handleList);
	const root = utils.SplitFilePath(playlistPath)[0];
	const report = [];
	paths.forEach((trackPath, i) => {if (!_isFile(trackPath)) {report.push(trackPath);}});
	if (handleList) {
		if (report.length) {fb.ShowPopupMessage('Failed when converting tracks to \'' + root + '\'.\nTracks not found:\n\n' + report.join('\n'), window.Name);}
		if (handleList.Count) {
			// Retrieve new paths
			bDone = savePlaylist(-1, playlistPath, ext, playlistName, null, list.data[z].isLocked, list.data[z].category, list.data[z].tags, '', list.data[z].trackTags, list.bBOM);
			bDone = bDone && addHandleToPlaylist(handleList, playlistPath, '', list.bBOM);
		}
	}
	bDone = bDone && _isFile(playlistPath); // Debug popups are already handled at prev line
	if (bDone) {
		if (list.properties.bOpenOnExport[1]) {_explorer(playlistPath);} 
		console.log('Playlist Manager: cloning ' + playlistName + ' done.');
		list.update();
		list.filter();
	}
	return bDone;
}

// TODO: Use m3u8 as default format if original playlist format is not writable
function exportPlaylistFile(list, z, defPath = '') {
	let bDone = false;
	const playlistPath = list.data[z].path;
	const playlistName = utils.SplitFilePath(playlistPath).slice(1).join('');
	let path = '';
	try {path = sanitizePath(utils.InputBox(window.ID, 'Enter destination path:', window.Name,  defPath.length ? defPath + playlistName : list.playlistsPath + 'Export\\' + playlistName, true));} 
	catch(e) {return bDone;}
	if (!path.length) {return bDone;}
	if (path === playlistPath) {console.log('Playlist Manager: can\'t export playlist to original path.'); return bDone;}
	bDone = _copyFile(playlistPath, path);
	if (bDone) {
		if (list.properties.bOpenOnExport[1]) {_explorer(path);} 
		console.log('Playlist Manager: exporting ' + playlistName + ' done.');
	} else {fb.ShowPopupMessage('Failed when copying playlist file to \'' + path + '\'. May be locked or there is already a file with such name.', window.Name);}
	return bDone;
}

function exportPlaylistFileWithRelPaths(list, z, ext = '', defPath = '') {
	let bDone = false;
	const playlistPath = list.data[z].path;
	const playlistName = utils.SplitFilePath(playlistPath).slice(1).join('');
	let newPath = '';
	try {newPath = sanitizePath(utils.InputBox(window.ID, 'Enter destination path:', window.Name,  defPath.length ? defPath + playlistName : list.playlistsPath + 'Export\\' + playlistName, true));} 
	catch(e) {return {bDone, newPath};}
	if (!newPath.length) {return {bDone, newPath};}
	if (newPath === playlistPath) {console.log('Playlist Manager: can\'t export playlist to original path.'); return {bDone, newPath};}
	const paths = getFilePathsFromPlaylist(playlistPath);
	let relPaths = paths.map((path) => {return '.\\' + path.split('\\').pop();});
	if (ext.length) {relPaths = relPaths.map((path) => {return path.split('.').slice(0, -1).concat([ext]).join('.');});}
	const codePage = checkCodePage(_open(playlistPath), list.data[z].extension);
	let file = _open(playlistPath, codePage !== -1 ? codePage : 0);
	if (file.length) {
		paths.forEach((path, i) => {file = file.replace(path, relPaths[i]);});
		let bDeleted = false;
		if (_isFile(newPath)) {
			bDeleted = _recycleFile(newPath, true);
		} else {bDeleted = true;}
		if (bDeleted) {
			bDone = _save(newPath, file, list.bBOM); // No BOM
			if (!bDone) {
				fb.ShowPopupMessage('Playlist generation failed while writing file \'' + newPath + '\'.', window.Name);
				_restoreFile(newPath); // Since it failed we need to restore the original playlist back to the folder!
				return {bDone, newPath, paths};
			}
		} else {
			fb.ShowPopupMessage('Playlist generation failed when overwriting a file \'' + newPath + '\'. May be locked.', window.Name);
			return {bDone, newPath, paths};
		}
	}
	console.log('Playlist Manager: exporting ' + playlistName + ' done.');
	return {bDone, newPath, paths};
}

function exportPlaylistFileWithTracks(list, z, defPath = '', bAsync = true) {
	let {bDone = false, newPath, paths} = exportPlaylistFileWithRelPaths(list, z, void(0), defPath);
	if (!newPath.length) {return;}
	if (bDone) {
		const root = utils.SplitFilePath(newPath)[0];
		const report = [];
		const plsRoot = utils.SplitFilePath(list.data[z].path)[0];
		new Promise((resolve) => {
			const total = paths.length - 1;
			const promises = [];
			paths.forEach((trackPath, i) => {
				promises.push(new Promise((resolve) => {
					const wait = bAsync ? 50 * i + (i % 4 === 0 ? 1000 : 0) : 0; // Give some time on Async processing between successive calls to not overload HDDs
					setTimeout(() => {
						const fileName = utils.SplitFilePath(trackPath).slice(1).join('');
						const outputName = root + fileName;
						let bCopy = false;
						if (trackPath.startsWith('.\\') || trackPath.startsWith('..\\')) { // Relative with indicator at start
							const absPath = findRelPathInAbsPath(trackPath, list.playlistsPath);
							bCopy = _copyFile(absPath, outputName, bAsync);
						} else if (_isFile(plsRoot + trackPath)) {bCopy = _copyFile(plsRoot + trackPath, outputName, bAsync);} // Relative without indicator
						else if (_isFile(trackPath)) {bCopy = _copyFile(trackPath, outputName, bAsync);} // Absolute 
						if (!bCopy && !_isFile(outputName)) {report.push(trackPath);} // Duplicates will fail on successive copying but present at output
						resolve('done');
					}, wait);
				}));
			});
			Promise.all(promises).then(() => {
				resolve('done');
			});
		}).then(() => {
			if (list.properties.bOpenOnExport[1]) {_explorer(newPath);}
			if (report.length) {fb.ShowPopupMessage('Failed when copying tracks to \'' + root + '\'.\nTracks not found:\n\n' + report.join('\n'), window.Name);}
			console.log('Playlist Manager: exporting ' + playlistName + ' done.');
			return bDone;
		});
	} else {fb.ShowPopupMessage('Failed when copying playlist file to \'' + newPath + '\'.', window.Name);}
	return bDone;
}

function exportPlaylistFileWithTracksConvert(list, z, tf = '.\%filename%.mp3', preset = '...', defPath = '', ext = '', remDupl = []) {
	const bOpenOnExport = list.properties.bOpenOnExport[1];
	if (bOpenOnExport) {fb.ShowPopupMessage('Playlist file will be exported to selected path. Track filenames will be changed according to the TF expression set at configuration.\n\nNote the TF expression should match whatever preset is used at the converter panel, otherwise actual filenames will not match with those on exported playlist.\n\nSame comment applies to the destination path, the tracks at the converter panel should be output to the same path the playlist file was exported to...\n\nConverter preset, filename TF and default path can be set at configuration (header menu). Default preset uses the one which requires user input. It\'s recommended to create a new preset for this purpose and set the output folder to be asked at conversion step.', window.Name);}
	let bDone = false;
	const pls = list.data[z];
	const playlistPath = pls.path;
	const bUI = pls.extension === '.ui';
	const bXSP = pls.extension === '.xsp';
	const arr = utils.SplitFilePath(playlistPath);
	const [playlistName, playlistExt] = bUI ? [pls.name, ''] : [arr[1], arr[2].toLowerCase()];
	let extension = ext.toLowerCase();
	if (!playlistExt.length) {extension = list.playlistsExtension;} // Use default extension for UI playlists
	const playlistNameExt = playlistName + (extension.length ? extension : playlistExt);
	// Set output
	let newPath = '';
	try {newPath = sanitizePath(utils.InputBox(window.ID, 'Current preset: ' + preset + ' --> ' + tf.match(/(.{1,100})/g).join('\n') + '\n\nEnter destination path:\n(root will be copied to clipboard)', window.Name, defPath.length ? defPath + playlistNameExt : list.playlistsPath + 'Export\\' + playlistNameExt, true));} 
	catch(e) {return bDone;}
	if (!newPath.length) {return bDone;}
	if (newPath === playlistPath) {console.log('Playlist Manager: can\'t export playlist to original path.'); return bDone;}
	// Get tracks
	const handleList = !bUI ? getHandlesFromPlaylist(playlistPath, list.playlistsPath, true, remDupl) : getHandleFromUIPlaylists([pls.nameId], false); // Omit not found
	const subsongRegex = /,\d*$/g;
	const paths = (!bUI && !bXSP ? getFilePathsFromPlaylist(playlistPath) : fb.TitleFormat('%path%').EvalWithMetadbs(handleList)).map((path) => {return path.replace(subsongRegex,'');});
	const root = utils.SplitFilePath(newPath)[0];
	_setClipboardData(root);
	const report = [];
	if (bUI) {
		const newHandleList = new FbMetadbHandleList();
		paths.forEach((trackPath, i) => {if (!_isFile(trackPath)) {report.push(trackPath);} else {newHandleList.Add(handleList[i]);}});
		if (report.length) { // Omit not found
			handleList.RemoveAll();
			handleList.AddRange(newHandleList);
		}
	} else {
		paths.forEach((trackPath, i) => {if (!_isFile(trackPath)) {report.push(trackPath);}});
	}
	if (handleList) {
		if (report.length) {
			fb.ShowPopupMessage('Failed when converting tracks to \'' + root + '\'.\nTracks not found:\n\n' + report.join('\n'), window.Name);
		}
		if (handleList.Count) {
			// Convert tracks
			fb.RunContextCommandWithMetadb('Convert/' + preset, handleList, 8);
			// Retrieve new paths
			const fileNames = fb.TitleFormat(tf).EvalWithMetadbs(handleList);
			if (!isArrayStrings(fileNames)) {
				fb.ShowPopupMessage('Playlist generation failed while guessing new filenames:\n\n' + fileNames.join('\n'), window.Name);
				return bDone;
			}
			// Copy playlist file when original extension and output extension are the same or both share same format (M3U)
			let file = '';
			let bDeleted; // 3 possible states, false, true or nothing deleted (undefined)
			if (_isFile(newPath)) {bDeleted = _recycleFile(newPath, true);}
			if (!extension.length || playlistExt.length && (playlistExt.startsWith(extension) || extension.startsWith(playlistExt))) {
				const codePage = checkCodePage(_open(playlistPath), pls.extension);
				file = _open(playlistPath, codePage !== -1 ? codePage : 0);
				paths.forEach((path, i) => {file = file.replace(path, fileNames[i]);});
			} else { // Or create new playlist file when translating between different formats
				savePlaylist(-1, newPath, extension, pls.name, null, pls.isLocked, pls.category, pls.tags, '', pls.trackTags, list.bBOM);
				addHandleToPlaylist(handleList, newPath, '', list.bBOM);
				file = _open(newPath, convertCharsetToCodepage('UTF-8'));
				paths.forEach((path, i) => {file = file.replace(path, fileNames[i]);});
			}
			if (bDeleted !== false) {
				bDone = file && file.length ? _save(newPath, file, list.bBOM) : false; // No BOM
				if (!bDone) {
					fb.ShowPopupMessage('Playlist generation failed while writing file \'' + newPath + '\'.', window.Name);
					if (bDeleted) {_restoreFile(newPath);} // Since it failed, may need to restore the original playlist back to the folder!
				}
			} else {
				fb.ShowPopupMessage('Playlist generation failed when overwriting a file \'' + newPath + '\'. May be locked.', window.Name);
				return bDone;
			}
			if (bOpenOnExport) {_explorer(newPath);}
			console.log('Playlist Manager: exporting ' + playlistName + ' done.');
		}
	}
	return bDone;
}

function exportAutoPlaylistFileWithTracksConvert(list, z, tf = '.\%filename%.mp3', preset = '...', defPath = '', ext = '', remDupl = []) {
	const bOpenOnExport = list.properties.bOpenOnExport[1];
	if (bOpenOnExport) {fb.ShowPopupMessage('Playlist file will be exported to selected path. Track filenames will be changed according to the TF expression set at configuration.\n\nNote the TF expression should match whatever preset is used at the converter panel, otherwise actual filenames will not match with those on exported playlist.\n\nSame comment applies to the destination path, the tracks at the converter panel should be output to the same path the playlist file was exported to...\n\nConverter preset, filename TF and default path can be set at configuration (header menu). Default preset uses the one which requires user input. It\'s recommended to create a new preset for this purpose and set the output folder to be asked at conversion step.', window.Name);}
	let bDone = false;
	const pls = list.data[z];
	const playlistName = pls.name;
	const extension = ext.length ? ext.toLowerCase() : list.playlistsExtension;
	const playlistNameExt = playlistName + extension;
	// Set output
	let newPath = '';
	try {newPath = sanitizePath(utils.InputBox(window.ID, 'Current preset: ' + preset + ' --> ' + tf.match(/(.{1,100})/g).join('\n') + '\n\nEnter destination path:\n(root will be copied to clipboard)', window.Name, defPath.length ? defPath + playlistNameExt : list.playlistsPath + 'Export\\' + playlistNameExt, true));} 
	catch(e) {return bDone;}
	if (!newPath.length) {return bDone;}
	// Get tracks
	if (!checkQuery(pls.query, true, true)) {fb.ShowPopupMessage('Query not valid:\n' + pls.query, window.Name); return bDone;}
	let handleList = fb.GetQueryItems(fb.GetLibraryItems(), pls.query);
	if (handleList && handleList.Count) {
		if (remDupl && remDupl.length && do_remove_duplicates) {handleList = do_remove_duplicates(handleList, null, remDupl);}
		if (pls.sort) {
			const sortObj = getSortObj(pls.sort);
			if (sortObj) {handleList.OrderByFormat(sortObj.tf, sortObj.direction);}
		}
		const subsongRegex = /,\d*$/g;
		const paths = fb.TitleFormat('%path%').EvalWithMetadbs(handleList).map((path) => {return path.replace(subsongRegex,'');});
		const root = utils.SplitFilePath(newPath)[0];
		_setClipboardData(root);
		const report = [];
		paths.forEach((trackPath, i) => {if (!_isFile(trackPath)) {report.push(trackPath);}});
		if (report.length) {
			fb.ShowPopupMessage('Failed when converting tracks to \'' + root + '\'.\nTracks not found:\n\n' + report.join('\n'), window.Name);
		}
		// Convert tracks
		fb.RunContextCommandWithMetadb('Convert/' + preset, handleList, 8);
		// Retrieve new paths
		const fileNames = fb.TitleFormat(tf).EvalWithMetadbs(handleList);
		if (!isArrayStrings(fileNames)) {
			fb.ShowPopupMessage('Playlist generation failed while guessing new filenames:\n\n' + fileNames.join('\n'), window.Name);
			return bDone;
		}
		let bDeleted; // 3 possible states, false, true or nothing deleted (undefined)
		if (_isFile(newPath)) {bDeleted = _recycleFile(newPath, true);}
		// Create new playlist file when translating between different formats
		savePlaylist(-1, newPath, extension, pls.name, null, pls.isLocked, pls.category, pls.tags, '', pls.trackTags, list.bBOM);
		addHandleToPlaylist(handleList, newPath, '', list.bBOM);
		let file = _open(newPath, convertCharsetToCodepage('UTF-8'));
		paths.forEach((path, i) => {file = file.replace(path, fileNames[i]);});
		if (bDeleted !== false) {
			bDone = file && file.length ? _save(newPath, file, list.bBOM) : false; // No BOM
			if (!bDone) {
				fb.ShowPopupMessage('Playlist generation failed while writing file \'' + newPath + '\'.', window.Name);
				if (bDeleted) {_restoreFile(newPath);} // Since it failed, may need to restore the original playlist back to the folder!
			}
		} else {
			fb.ShowPopupMessage('Playlist generation failed when overwriting a file \'' + newPath + '\'. May be locked.', window.Name);
			return bDone;
		}
		if (bOpenOnExport) {_explorer(newPath);}
		console.log('Playlist Manager: exporting ' + playlistName + ' done.');
	}
	return bDone;
}

function renamePlaylist(list, z, newName, bUpdatePlman = true) {
	const pls = list.data[z];
	const oldName = pls.name;
	const oldNameId = pls.nameId;
	const oldId = pls.id;
	const newNameId = newName + ((list.bUseUUID && pls.id.length) ? pls.id : ''); // May have enabled/disabled UUIDs just before renamin
	const newId = (list.bUseUUID && oldId.length) ? oldId : nextId(list.optionsUUIDTranslate(), true); // May have enabled/disabled UUIDs just before renaming
	var duplicated = plman.FindPlaylist(newNameId);
	let bRenamedSucessfully = false;
	if (bUpdatePlman && duplicated !== -1 || !bUpdatePlman && duplicated !== plman.ActivePlaylist) { // Playlist already exists on foobar...
		fb.ShowPopupMessage('You can not have duplicated playlist names within foobar: ' + oldName + '\n' + 'Choose another unique name for renaming.', window.Name);
	} else {
		delayAutoUpdate();
		if (newName.length && newName !== oldName) {
			if (pls.isAutoPlaylist || pls.extension === '.ui') {
				list.editData(pls, {
					name: newName,
					id: list.bUseUUID ? newId : '', // May have enabled/disabled UUIDs just before renaming
					nameId: list.bUseUUID && pls.extension !== '.ui' ? newName + newId : newName,
				});
				if (bUpdatePlman) {list.updatePlman(pls.nameId, oldNameId);} // Update with new id
				list.update(true, true);
				list.filter();
				bRenamedSucessfully = true;
			} else {
				if (_isFile(pls.path)) {
					// Backup
					const oldPath = pls.path;
					const backPath = pls.path + '.back';
					_copyFile(oldPath, backPath);
					// Locked files have the name variable as read only, so we only change the filename. We can not replace oldName with new name since successive renaming steps would not work. We simply strip the filename and replace it with the new name
					let newPath = sanitizePath(pls.path.split('.').slice(0,-1).join('.').split('\\').slice(0,-1).concat([newName]).join('\\') + pls.extension);
					bRenamedSucessfully = oldPath !== newPath ? _renameFile(oldPath, newPath) : true;
					if (bRenamedSucessfully) {
						list.editData(pls, {
							path: newPath,
						});
						if (!pls.isLocked) {
							let bDone = false;
							let reason = -1;
							if (pls.extension === '.m3u' || pls.extension === '.m3u8') {
								let originalStrings = ['#PLAYLIST:' + oldName, '#UUID:' + oldId];
								let newStrings = ['#PLAYLIST:' + newName, '#UUID:' + (list.bUseUUID ? newId : '')];
								[bDone, reason] = editTextFile(newPath, originalStrings, newStrings, list.bBOM); // No BOM
								if (!bDone && reason === 1) { // Retry with new header
									bDone = rewriteHeader(list, z); 
									if (bDone) {bDone = editTextFile(newPath, originalStrings, newStrings, list.bBOM);}
								}
							} else if (pls.extension === '.xspf') {
								let originalStrings = ['<title>' + oldName, '<meta rel="uuid">' + oldId];
								let newStrings = ['<title>' + newName, '<meta rel="uuid">' + (list.bUseUUID ? newId : '')];
								[bDone, reason] = editTextFile(newPath, originalStrings, newStrings, list.bBOM); // No BOM
								if (!bDone && reason === 1) { // Retry with new header
									bDone = rewriteHeader(list, z); 
									if (bDone) {bDone = editTextFile(newPath, originalStrings, newStrings, list.bBOM);}
								}
							} else if (pls.extension === '.xsp') {
								let originalStrings = ['<name>' + oldName];
								let newStrings = ['<name>' + newName];
								[bDone, reason] = editTextFile(newPath, originalStrings, newStrings, list.bBOM); // No BOM
							} else {bDone = true;}
							if (!bDone) {
								fb.ShowPopupMessage('Error renaming playlist file: ' + oldName + ' --> ' + newName + '\n\nOld Path: ' + oldPath + '\nNew Path: ' + newPath + '\n\nRestoring backup...', window.Name);
								_renameFile(backPath, oldPath); // Restore backup in case something goes wrong
								console.log('Playlist manager: Restoring backup...');
							} else {
								list.editData(pls, {
									name: newName,
									id: list.bUseUUID ? newId : '', // May have enabled/disabled UUIDs just before renaming
									nameId: list.bUseUUID ? newName + newId : newName,
								});
								if (bUpdatePlman) {list.updatePlman(pls.nameId, oldNameId);} // Update with new id
								list.update(true, true);
								list.filter();
								bRenamedSucessfully = true;
							}
						} else {
							list.update(true, true);
							list.filter();
							bRenamedSucessfully = true;
						}
					} else {fb.ShowPopupMessage('Error renaming playlist file: ' + oldName + ' --> ' + newName + '\n\nOld Path: ' + oldPath + '\nNew Path: ' + newPath + '\n\nRestoring backup...', window.Name);}
					if (!_isFile(oldPath) && !_isFile(newPath)) {_renameFile(backPath, oldPath); console.log('Playlist manager: Restoring backup...');} // Restore backup in case something goes wrong
					else {_deleteFile(backPath);}
				} else {fb.ShowPopupMessage('Playlist file does not exist: ' + pls.name + '\nPath: ' + pls.path, window.Name);}
			}
		}
	}
	return bRenamedSucessfully;
}

function cycleCategories() {
	const options = ['All', ...list.categories()];
	let idx = 0; // All is the default
	if (list.categoryState.length === 1) { // If there is currently only one category selected then use the next one
		idx = options.indexOf(list.categoryState[0]);
		idx++;
	}
	else if (isArrayEqual(list.categoryState,list.categories())) {idx++;} // If it's already showing all categories, then use the first one
	if (idx >= options.length) {idx = 0;} // And cycle
	const categoryState = idx ? [options[idx]] : options.slice(1);
	list.filter({categoryState});
}

function cycleTags() {
	const options = ['All', ...list.tags()];
	let idx = 0; // All is the default
	if (list.tagState.length === 1) { // If there is currently only one category selected then use the next one
		idx = options.indexOf(list.tagState[0]);
		idx++;
	}
	else if (isArrayEqual(list.tagState,list.tags())) {idx++;} // If it's already showing all categories, then use the first one
	if (idx >= options.length) {idx = 0;} // And cycle
	const tagState = idx ? [options[idx]] : options.slice(1);
	list.filter({tagState});
}

function rewriteXSPQuery(pls, newQuery) {
	let bDone = false;
	if (pls.extension === '.xsp') {
		const {rules, match} = XSP.getRules(newQuery);
		if (rules.length) {
			const playlistPath = pls.path;
			const bCache = xspCache.has(playlistPath);
			let playlistText = '';
			if (!bCache) {
				playlistText = _open(playlistPath);
				if (playlistText && playlistText.length) {
					// Safe checks to ensure proper encoding detection
					const codePage = checkCodePage(playlistText, '.xsp');
					if (codePage !== -1) {playlistText = _open(playlistPath, codePage); if (!playlistText.length) {return bDone;}}
				} else {return bDone;}
			}
			const xmldom = bCache ? null : XSP.XMLfromString(playlistText);
			const jsp = bCache ? xspCache.get(playlistPath) : XSP.toJSP(xmldom);
			if (!bCache) {xspCache.set(playlistPath, jsp);}
			jsp.playlist.rules = rules;
			jsp.playlist.match = match;
			const xspText = XSP.toXSP(jsp);
			if (xspText && xspText.length) {
				// Backup
				const backPath = playlistPath + '.back';
				_copyFile(playlistPath, backPath);
				bDone = _save(playlistPath, xspText.join('\r\n'));
				if (!bDone) {
					_renameFile(backPath, playlistPath); // Restore backup in case something goes wrong
					console.log('Playlist manager: Restoring backup...');
				} else if (_isFile(backPath)) {_deleteFile(backPath);}
			}
		}
	}
	return bDone;
}

function rewriteXSPSort(pls, newSort) {
	let bDone = false;
	if (pls.extension === '.xsp') {
		const order = XSP.getOrder(newSort);
		const playlistPath = pls.path;
		const bCache = xspCache.has(playlistPath);
		let playlistText = '';
		if (!bCache) {
			playlistText = _open(playlistPath);
			if (playlistText && playlistText.length) {
				// Safe checks to ensure proper encoding detection
				const codePage = checkCodePage(playlistText, '.xsp');
				if (codePage !== -1) {playlistText = _open(playlistPath, codePage); if (!playlistText.length) {return bDone;}}
			} else {return bDone;}
		}
		const xmldom = bCache ? null : XSP.XMLfromString(playlistText);
		const jsp = bCache ? xspCache.get(playlistPath) : XSP.toJSP(xmldom);
		if (!bCache) {xspCache.set(playlistPath, jsp);}
		jsp.playlist.order = order;
		const xspText = XSP.toXSP(jsp);
		if (xspText && xspText.length) {
			// Backup
			const backPath = playlistPath + '.back';
			_copyFile(playlistPath, backPath);
			bDone = _save(playlistPath, xspText.join('\r\n'));
			if (!bDone) {
				_renameFile(backPath, playlistPath); // Restore backup in case something goes wrong
				console.log('Playlist manager: Restoring backup...');
			} else if (_isFile(backPath)) {_deleteFile(backPath);}
		}
	}
	return bDone;
}

function rewriteXSPLimit(pls, newLimit) {
	let bDone = false;
	if (pls.extension === '.xsp') {
		const playlistPath = pls.path;
		const bCache = xspCache.has(playlistPath);
		let playlistText = '';
		if (!bCache) {
			playlistText = _open(playlistPath);
			if (playlistText && playlistText.length) {
				// Safe checks to ensure proper encoding detection
				const codePage = checkCodePage(playlistText, '.xsp');
				if (codePage !== -1) {playlistText = _open(playlistPath, codePage); if (!playlistText.length) {return bDone;}}
			} else {return bDone;}
		}
		const xmldom = bCache ? null : XSP.XMLfromString(playlistText);
		const jsp = bCache ? xspCache.get(playlistPath) : XSP.toJSP(xmldom);
		if (!bCache) {xspCache.set(playlistPath, jsp);}
		jsp.playlist.limit = Number.isFinite(newLimit) ? newLimit : 0;
		const xspText = XSP.toXSP(jsp);
		if (xspText && xspText.length) {
			// Backup
			const backPath = playlistPath + '.back';
			_copyFile(playlistPath, backPath);
			bDone = _save(playlistPath, xspText.join('\r\n'));
			if (!bDone) {
				_renameFile(backPath, playlistPath); // Restore backup in case something goes wrong
				console.log('Playlist manager: Restoring backup...');
			} else if (_isFile(backPath)) {_deleteFile(backPath);}
		}
	}
	return bDone;
}

function backup(n = 50) { // Backup playlist and json file
	let test = new FbProfiler('Playlist manager Backup');
	if (n && n !== -1) {
		const files = getFiles(list.playlistsPath + '_backup\\', new Set(['.zip'])).reverse();
		while (files.length >= n) {
			_recycleFile(files.pop(), true);
		}
	}
	const playlistFilesMask = [...loadablePlaylistFormats].map((ext) => {return list.playlistsPath + '*' + ext;}); // Ext already has a .
	_zip([...playlistFilesMask, list.filename, list.filename + '.old'], list.playlistsPath + '_backup\\' + new Date().toISOString().split('.')[0].replace(/[ :,]/g,'_') + '.zip');
	test.Print();
}

function findMixedPaths() {
	const found = [];
	return new Promise((resolve) => {
		const total = list.itemsAll - 1;
		const promises = [];
		let prevProgress = -1;
		list.dataAll.forEach((playlist, i) => {
			promises.push(new Promise((resolve) => {
				setTimeout(() => {
					if (!playlist.isAutoPlaylist && playlist.extension !== '.fpl' && playlist.extension !== '.ui') {
						const filePaths = getFilePathsFromPlaylist(playlist.path);
						if (filePaths.some((path) => {return !(/[A-Z]*:\\/.test(path));}) && filePaths.some((path) => {return (/[A-Z]*:\\/.test(path));})) {found.push(playlist.path);}
					}
					const progress = Math.round(i / total * 10) * 10;
					if (progress > prevProgress) {prevProgress = progress; console.log('Checking paths ' + progress + '%.');}
					resolve('done');
				}, 10 * i);
			}));
		});
		Promise.all(promises).then(() => {
			resolve(found);
		});
	});
}
async function findMixedPathsAsync() {return await findMixedPaths();}

function findExternal() {
	const found = [];
	return new Promise((resolve) => {
		const total = list.itemsAll - 1;
		const promises = [];
		let prevProgress = -1;
		const subsongRegex = /,\d*$/g;
		list.dataAll.forEach((playlist, i) => {
			promises.push(new Promise((resolve) => {
				setTimeout(() => {
					if (!playlist.isAutoPlaylist && playlist.extension !== '.fpl') {
						const bUI = playlist.extension === '.ui';
						const filePaths = !bUI ? getFilePathsFromPlaylist(playlist.path) : fb.TitleFormat('%path%').EvalWithMetadbs(getHandleFromUIPlaylists([playlist.nameId], false));
						if (!arePathsInMediaLibrary(filePaths, list.playlistsPath)) {
							const relPathSplit = list.playlistsPath.length ? list.playlistsPath.split('\\').filter(Boolean) : null;
							const bDead = filePaths.map((path) => {return path.replace(subsongRegex,'');}).some((path) => {
								// Skip streams & look for absolute and relative paths (with and without .\)
								let bCheck = !path.startsWith('http:') && !path.startsWith('https:');
								if (/[A-Z]*:\\/.test(path)) {bCheck = bCheck && !_isFile(path);}
								else {
									let pathAbs = path;
									if (pathAbs.startsWith('.\\')) {pathAbs = pathAbs.replace('.\\', list.playlistsPath);}
									else {relPathSplit.forEach((folder) => {pathAbs = pathAbs.replace('..\\', folder + '\\');});}
									bCheck = bCheck && !_isFile(pathAbs);
								}
								return bCheck;
							});
							if (bDead) {
								found.push((bUI ? playlist.nameId : playlist.path) + '(contains dead items)');
							} else {
								found.push(bUI ? playlist.nameId : playlist.path);
							}
						}
					}
					const progress = Math.round(i / total * 10) * 10;
					if (progress > prevProgress) {prevProgress = progress; console.log('Checking external items ' + progress + '%.');}
					resolve('done');
				}, iDelayPlaylists * i);
			}));
		});
		Promise.all(promises).then(() => {
			resolve(found);
		});
	});
}
async function findExternalAsync() {return await findExternal();}

function findDead() {
	const found = [];
	return new Promise((resolve) => {
		const total = list.itemsAll - 1;
		const promises = [];
		let prevProgress = -1;
		let iDelay = 0;
		const subsongRegex = /,\d*$/g;
		list.dataAll.forEach((playlist, i) => {
			iDelay = isNaN(playlist.size) ? iDelay + iDelayPlaylists : iDelay + iDelayPlaylists * (1 + Math.floor(playlist.size / 100));
			promises.push(new Promise((resolve) => {
				setTimeout(() => {
					if (!playlist.isAutoPlaylist && playlist.extension !== '.fpl') {
						const bUI = playlist.extension === '.ui';
						const relPathSplit = list.playlistsPath.length ? list.playlistsPath.split('\\').filter(Boolean) : null;
						const filePaths = (!bUI ? getFilePathsFromPlaylist(playlist.path) : fb.TitleFormat('%path%').EvalWithMetadbs(getHandleFromUIPlaylists([playlist.nameId], false))).map((path) => {return path.replace(subsongRegex,'');});
						const bDead = filePaths.some((path) => {
							// Skip streams & look for absolute and relative paths (with and without .\)
							let bCheck = !path.startsWith('http:') && !path.startsWith('https:');
							if (/[A-Z]*:\\/.test(path)) {bCheck = bCheck && !_isFile(path);}
							else {
								let pathAbs = path;
								if (pathAbs.startsWith('.\\')) {pathAbs = pathAbs.replace('.\\', list.playlistsPath);}
								else {
									const relPathSplit = list.playlistsPath.length ? list.playlistsPath.split('\\').filter(Boolean) : null;
									pathAbs = findRelPathInAbsPath(pathAbs, list.playlistsPath);
								}
								bCheck = bCheck && !_isFile(pathAbs);
							}
							return bCheck;
						});
						if (bDead) {found.push(bUI ? playlist.nameId : playlist.path);}
					}
					const progress = Math.round(i / total * 10) * 10;
					if (progress > prevProgress) {prevProgress = progress; console.log('Checking dead items ' + progress + '%.');}
					resolve('done');
				}, iDelay);
			}));
		});
		Promise.all(promises).then(() => {
			resolve(found);
		});
	});
}
async function findDeadAsync() {return await findDead();}

function findDuplicates() {
	const found = [];
	return new Promise((resolve) => {
		const total = list.itemsAll - 1;
		const promises = [];
		let prevProgress = -1;
		list.dataAll.forEach((playlist, i) => {
			promises.push(new Promise((resolve) => {
				setTimeout(() => {
					if (!playlist.isAutoPlaylist && playlist.extension !== '.fpl') {
						const bUI = playlist.extension === '.ui';
						const filePaths = !bUI ? getFilePathsFromPlaylist(playlist.path) : fb.TitleFormat('%path%').EvalWithMetadbs(getHandleFromUIPlaylists([playlist.nameId], false));
						if (new Set(filePaths).size !== filePaths.length) {found.push(bUI ? playlist.nameId : playlist.path);}
					}
					const progress = Math.round(i / total * 10) * 10;
					if (progress > prevProgress) {prevProgress = progress; console.log('Checking duplicates ' + progress + '%.');}
					resolve('done');
				}, iDelayPlaylists / 5 * i);
			}));
		});
		Promise.all(promises).then(() => {
			resolve(found);
		});
	});
}
async function findDuplicatesAsync() {return await findDuplicates();}

function findSizeMismatch() {
	const found = [];
	return new Promise((resolve) => {
		const total = list.itemsAll - 1;
		const promises = [];
		let prevProgress = -1;
		list.dataAll.forEach((playlist, i) => {
			promises.push(new Promise((resolve) => {
				setTimeout(() => {
					if (!playlist.isAutoPlaylist && playlist.extension !== '.xsp' && playlist.extension !== '.fpl' && playlist.extension !== '.ui') {
						const filePathsNum = getFilePathsFromPlaylist(playlist.path).length;
						let text = _isFile(playlist.path) ? _open(playlist.path) : void(0);
						let size;
						if (text.length) {
							const codePage = checkCodePage(text, playlist.extension);
							if (codePage !== -1) {text = _open(playlist.path, codePage, true);}
							if (playlist.extension === '.m3u8' || playlist.extension === '.m3u') {
								text = text.split(/\r\n|\n\r|\n|\r/);
								const lines = text.length;
								let j = 0;
								while (j < lines) { // Changes size Line
									if (text[j].startsWith('#PLAYLISTSIZE:')) {
										size = Number(text[j].split(':')[1]);
										break;
									}
									j++;
								}
							} else if (playlist.extension === '.pls') {
								text = text.split(/\r\n|\n\r|\n|\r/);
								const lines = text.length;
								let j = 0;
								if (text[lines - 2].startsWith('NumberOfEntries=')) {
									size = Number(text[lines - 2].split('=')[1]);
								}
							} else if (playlist.extension === '.strm') {
								text = text.split(/\r\n|\n\r|\n|\r/);
								size = 0;
								for (let line of text) {
									if (line.trim().length) {size++;}
								}
							} else if (playlist.extension === '.xspf') {
								const xmldom = XSPF.XMLfromString(text);
								const jspf = XSPF.toJSPF(xmldom, false);
								if (jspf.hasOwnProperty('playlist') && jspf.playlist) {
									const jPls = jspf.playlist;
									if (jPls.hasOwnProperty('meta') && Array.isArray(jPls.meta) && jPls.meta.length) {
										for (let metaData of jPls.meta) {
											if (metaData.hasOwnProperty('playlistSize')) {size = typeof metaData.playlistSize !== 'undefined' ? Number(metaData.playlistSize) : null;}
										}
									}
								}
							}
						} 
						if (typeof text === 'undefined' || !text.length) {found.push(playlist.path + ' (blank)');}
						else if (typeof size === 'undefined') {found.push(playlist.path + ' (no size tag found)');}
						else if (filePathsNum !== size) {found.push(playlist.path + ' (tag: ' + size + ', paths: ' + filePathsNum + ')');}
						else if (playlist.extension === '.strm' && size > 1) {found.push(playlist.path + ' (paths: ' + filePathsNum + ', .srtrm size can not be > 1)');}
					}
					const progress = Math.round(i / total * 10) * 10;
					if (progress > prevProgress) {prevProgress = progress; console.log('Checking size ' + progress + '%.');}
					resolve('done');
				}, iDelayPlaylists / 5 * i);
			}));
		});
		Promise.all(promises).then(() => {
			resolve(found);
		});
	});
}
async function findSizeMismatchAsync() {return await findSizeMismatch();}

function findDurationMismatch() {
	const found = [];
	return new Promise((resolve) => {
		const total = list.itemsAll - 1;
		const promises = [];
		let prevProgress = -1;
		list.dataAll.forEach((playlist, i) => {
			promises.push(new Promise((resolve) => {
				setTimeout(() => {
					if (!playlist.isAutoPlaylist && playlist.extension !== '.xsp' && playlist.extension !== '.fpl' && playlist.extension !== '.ui') {
						const handleList = getHandlesFromPlaylist(playlist.path, list.playlistsPath);
						if (handleList) {
							const calcDuration = handleList.CalcTotalDuration();
							let text = _isFile(playlist.path) ? _open(playlist.path) : void(0);
							let duration;
							if (typeof text !== 'undefined' && text.length) {
								const codePage = checkCodePage(text, playlist.extension);
								if (codePage !== -1) {text = _open(playlist.path, codePage, true);}
								if (playlist.extension === '.m3u8' || playlist.extension === '.m3u') {
									text = text.split(/\r\n|\n\r|\n|\r/);
									const lines = text.length;
									let j = 0;
									while (j < lines) { // Changes duration Line
										if (text[j].startsWith('#DURATION:')) {
											duration = Number(text[j].split(':')[1]);
											break;
										}
										j++;
									}
								} else if (playlist.extension === '.xspf') {
									const xmldom = XSPF.XMLfromString(text);
									const jspf = XSPF.toJSPF(xmldom, false);
									if (jspf.hasOwnProperty('playlist') && jspf.playlist) {
										const jPls = jspf.playlist;
										if (jPls.hasOwnProperty('meta') && Array.isArray(jPls.meta) && jPls.meta.length) {
											for (let metaData of jPls.meta) {
												if (metaData.hasOwnProperty('duration')) {duration = typeof metaData.playlistSize !== 'undefined' ? Number(metaData.duration) : null;}
											}
										}
									}
								}
							}
							if (typeof duration === 'undefined') {found.push(playlist.path + ' (no duration tag found)');}
							else if (calcDuration !== duration) {found.push(playlist.path + ' (tag: ' + duration + ', calculated: ' + calcDuration + ')');}
						}
					}
					const progress = Math.round(i / total * 10) * 10;
					if (progress > prevProgress) {prevProgress = progress; console.log('Checking duration ' + progress + '%.');}
					resolve('done');
				}, iDelayPlaylists * i);
			}));
		});
		Promise.all(promises).then(() => {
			resolve(found);
		});
	});
}
async function findDurationMismatchAsync() {return await findDurationMismatch();}

function findBlank() {
	const found = [];
	return new Promise((resolve) => {
		const total = list.itemsAll - 1;
		const promises = [];
		let prevProgress = -1;
		list.dataAll.forEach((playlist, i) => {
			promises.push(new Promise((resolve) => {
				setTimeout(() => {
					if (!playlist.isAutoPlaylist && playlist.extension !== '.fpl' && playlist.extension !== '.ui') {
						let text = _isFile(playlist.path) ? _open(playlist.path) : void(0);
						let size, lines;
						if (typeof text !== 'undefined' && text.length) {
							const codePage = checkCodePage(text, playlist.extension);
							if (codePage !== -1) {text = _open(playlist.path, codePage, true);}
							lines = text.split(/\r\n|\n\r|\n|\r/);
							size = lines.filter(Boolean).length;
							lines = lines.length;
						} 
						if (typeof text === 'undefined' || typeof size === 'undefined') {found.push(playlist.path + ' (blank)');}
						else if (size !== lines) {found.push(playlist.path + ' (Blank: ' + (lines - size) + ', lines: ' + lines + ')');}
					}
					const progress = Math.round(i / total * 10) * 10;
					if (progress > prevProgress) {prevProgress = progress; console.log('Checking blank lines ' + progress + '%.');}
					resolve('done');
				}, iDelayPlaylists / 5 * i);
			}));
		});
		Promise.all(promises).then(() => {
			resolve(found);
		});
	});
}
async function findBlankAsync() {return await findBlank();}