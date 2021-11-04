﻿'use strict';
//04/11/21

/* 	Playlist Manager
	Manager for Playlists Files and Auto-Playlists. Shows a virtual list of all playlists files within a configured folder (playlistPath).
	See readmes\playlist_manager.pdf for full documentation
*/

window.DefineScript('Playlist Manager', { author: 'XXX', version: '0.5.0', features: {drag_n_drop: false}});
include('helpers\\helpers_xxx.js');
include('helpers\\helpers_xxx_properties.js');
include('helpers\\helpers_xxx_playlists.js');
include('helpers\\helpers_xxx_playlists_files.js');
include('helpers\\buttons_panel_xxx.js');
include('helpers\\playlist_manager_list.js');
include('helpers\\playlist_manager_panel.js');
include('helpers\\playlist_manager_buttons.js');
include('helpers\\playlist_manager_menu.js');
include('helpers\\playlist_manager_helpers.js');

let precacheLibraryPathsIds = [window.ID];
window.NotifyOthers('precacheLibraryPaths instances', precacheLibraryPathsIds);
setTimeout(() => {
	if (window.ID === precacheLibraryPathsIds[0]) { // Only execute once per Foobar2000 instance
		precacheLibraryPathsAsync().then((result) => {
			window.NotifyOthers('precacheLibraryPaths', [...libItemsAbsPaths]);
			console.log(result);
		}, (error) => {
			// Already using data from other instance. See on_notify_data
		}).finally(() => {
			if (list && list.bRelativePath && list.playlistsPath) {precacheLibraryRelPaths(list.playlistsPath);}
		});
	}
},500)

var properties = {
	playlistPath			: ['Path to the folder containing the playlists' , (_isFile(fb.FoobarPath + 'portable_mode_enabled') ? '.\\profile\\' : fb.ProfilePath) + 'playlist_manager\\'],
	autoSave				: ['Auto-save delay with loaded foobar playlists (in ms). Forced > 1000. 0 disables it.', 3000],
	bFplLock				: ['Load .fpl native playlists as read only?' , true],
	extension				: ['Extension used when saving playlists (' + Array.from(writablePlaylistFormats).join(', ') + ')', '.m3u8'],
	autoUpdate				: ['Periodically checks playlist path (in ms). Forced > 200. 0 disables it.' , 5000],
	bShowSize				: ['Show playlist size' , true],
	bUpdateAutoplaylist		: ['Update Autoplaylist size by query output', true],
	bUseUUID				: ['Use UUIDs along playlist names (not available for .pls playlists).', true],
	optionUUID				: ['UUID current method', ''],
	methodState				: ['Current sorting method. Allowed: ', ''], // Description and value filled on list.init() with defaults. Just a placeholder
	sortState				: ['Current sorting order. Allowed: ', ''], // Description and value filled on list.init() with defaults. Just a placeholder
	bSaveFilterStates		: ['Maintain filters between sessions?', true], // Description and value filled on list.init() with defaults. Just a placeholder
	filterStates			: ['Current filters: ', '0,0'], // Description and value filled on list.init() with defaults. Just a placeholder
	bShowSep				: ['Show name/category separators: ', true],
	listColours				: ['Color codes for the list. Use contextual menu to set them: ', ''],
	bFirstPopup				: ['Playlist Manager: Fired once', false],
	bRelativePath			: ['Use relative paths for all new playlists', false],
	bFirstPopupFpl			: ['Playlist Manager fpl: Fired once', false],
	bFirstPopupPls			: ['Playlist Manager pls: Fired once', false],
	categoryState			: ['Current categories showed.', '[]'], // Description and value filled on list.init() with defaults. Just a placeholder
	bShowTips				: ['Usage text on tooltips.', true],
	bAutoLoadTag			: ['Automatically add \'bAutoLoad\' to all playlists', false],
	bAutoLockTag			: ['Automatically add \'bAutoLock\' to all playlists', false],
	bAutoCustomTag			: ['Automatically add custom tags to all playlists', false],
	autoCustomTag			: ['Custom tags to add', ''],
	bApplyAutoTags			: ['Apply actions based on tags (lock, load)', false],
	// autoPlaylistTags		: ['Playlist tags and actions config', JSON.parse({bAutoLoadTag: false, bAutoLockTag: false, bAutoCustomTag: false, bApplyAutoTags: false, autoCustomTag: ''})],
	bAutoTrackTag			: ['Enable auto-tagging for added tracks (at autosave)', false],
	bAutoTrackTagAlways		: ['Enable auto-tagging for added tracks (always)', false],
	bAutoTrackTagPls		: ['Auto-tagging for standard playlists', false],
	bAutoTrackTagLockPls	: ['Auto-tagging for locked playlists', false],
	bAutoTrackTagAutoPls	: ['Auto-tagging for AutoPlaylists', false],
	bAutoTrackTagAutoPlsInit: ['Auto-tagging for AutoPlaylists at startup', false],
	converterPreset			: ['Converter Preset list', JSON.stringify([
		{name: '', dsp: '...', tf: '.\\%filename%.mp3', path: '', extension: ''}, // Export all at same folder
		{name: '', dsp: '...', tf: '.\\%artist%\\%album%\\%track% - %title%.mp3', path: '', extension: ''}, // Transfer library
		{name: '--Kodi Librelec (<your_disk_name>)--', dsp: '...', tf: '\\media\\<your_disk_name>\\music\\%artist%\\%album%\\%track% - %title%.mp3', path: '', extension: '.m3u'}, // Kodi-like library
		{name: '--Kodi Windows (<your_disk_name>)--', dsp: '...', tf: '<your_disk_name>:\\music\\%artist%\\%album%\\%track% - %title%.mp3', path: '', extension: '.m3u'}, // Kodi-like library
		{name: '--Foobar2000 mobile (playlists folder)--', dsp: '...', tf: '..\\music\\%artist%\\%album%\\%track% - %title%.mp3', path: '', extension: '.m3u8'}, // Foobar2000 mobile, playlists on different folder than music
		{name: '--Foobar2000 mobile (root)--', dsp: '...', tf: '.\\music\\%artist%\\%album%\\%track% - %title%.mp3', path: '', extension: '.m3u8'}, // Foobar2000 mobile, playlists on same root than music (without a folder)
		{name: '--Foobar2000 mobile (same folder)--', dsp: '...', tf: '.\\%artist%\\%album%\\%track% - %title%.mp3', path: '', extension: '.m3u8'} // Foobar2000 mobile, playlists on same folder than music
	])],
	bForbidDuplicates		: ['Skip duplicates when adding to playlists', true],
	bDeadCheckAutoSave		: ['Warn about dead items on auto-save', false],
	bBOM					: ['Save files as UTF8 with BOM?', false],
	removeDuplicatesAutoPls	: ['AutoPlaylists, Remove duplicates by', 'artist,date,title'],
	bRemoveDuplicatesAutoPls: ['AutoPlaylists, filtering enabled', true],
	bShowMenuHeader			: ['Show header on playlist menus?', true],
	bCopyAsync				: ['Copy tracks asynchronously on export?', true],
	bRemoveDuplicatesSmartPls: ['Smart Playlists, filtering enabled', true],
	bSavingWarnings			: ['Warnings when saving to another format', true],
	bFirstPopupXsp			: ['Playlist Manager xsp: Fired once', false],
	bFirstPopupXspf			: ['Playlist Manager xspf: Fired once', false],
	bCheckDuplWarnings		: ['Warnings when loading duplicated playlists', true],
	bSavingXsp				: ['Auto-save .xsp playlists?', false],
	bAllPls					: ['Track UI-only playlists?', false]
};
properties['playlistPath'].push({func: isString, portable: true}, properties['playlistPath'][1]);
properties['autoSave'].push({func: isInt, range: [[0,0],[1000, Infinity]]}, properties['autoSave'][1]); // Safety limit 0 or > 1000
properties['extension'].push({func: (val) => {return writablePlaylistFormats.has(val);}}, properties['extension'][1]);
properties['autoUpdate'].push({func: isInt, range: [[0,0],[200, Infinity]]}, properties['autoUpdate'][1]); // Safety limit 0 or > 200
var prefix = 'plm_';
setProperties(properties, prefix);

{ // Info Popup
	let prop = getPropertiesPairs(properties, prefix);
	if (!prop['bFirstPopup'][1]) {
		prop['bFirstPopup'][1] = true;
		overwriteProperties(prop); // Updates panel
		isPortable(prop['playlistPath'][0]);
		const readmePath = folders.xxx + 'helpers\\readme\\playlist_manager.txt';
		if ((isCompatible('1.4.0') ? utils.IsFile(readmePath) : utils.FileTest(readmePath, 'e'))) {
			const readme = utils.ReadTextFile(readmePath, convertCharsetToCodepage('UTF-8'));
			if (readme.length) {fb.ShowPopupMessage(readme, window.Name);}
		}
	}
}

let panel = new _panel(true);
let list = new _list(LM, TM, 0, 0);

const autoSaveTimer =  Number(getPropertyByKey(properties, 'autoSave', prefix)); 
const autoUpdateTimer =  Number(getPropertyByKey(properties, 'autoUpdate', prefix));

function on_colours_changed() {
	panel.colours_changed();
	window.Repaint();
}

function on_font_changed() {
	panel.font_changed();
	window.Repaint();
}

function on_key_down(k) {
	list.key_down(k);
}

function on_mouse_lbtn_up(x, y, mask) {
	if (cur_btn === null) {
		list.lbtn_up(x, y, mask);
	}
	on_mouse_lbtn_up_buttn(x, y);
}

function on_mouse_lbtn_down(x, y) {
	on_mouse_lbtn_down_buttn(x, y);
}

function on_mouse_lbtn_dblclk(x, y) {
	if (cur_btn === null) {
		list.lbtn_dblclk(x, y);
	}
}

function on_mouse_move(x, y, mask) {
	on_mouse_move_buttn(x, y, mask);
	if (cur_btn === null) {
		list.move(x, y, mask);
	}
}

function on_mouse_leave() {
	on_mouse_leave_buttn();
	list.onMouseLeaveList(); // Clears index selector
}

function on_mouse_rbtn_up(x, y) {
	// Must return true, if you want to suppress the default context menu.
	// Note: left shift + left windows key will bypass this callback and will open default context menu.
	return (list.traceHeader(x, y) ? createMenuRightTop().btn_up(x, y) : createMenuRight().btn_up(x, y));
}

function on_mouse_wheel(s) {
	list.wheel(s);
}

function on_paint(gr) {
	panel.paint(gr);
	list.paint(gr);
	on_paint_buttn(gr);
}

function on_size() {
	panel.size();
	list.w = panel.w - (LM * 2);
	list.h = panel.h - TM;
	list.size();
	on_size_buttn();
}

function on_playback_new_track() { // To show playing now indicators...
	window.Repaint();
}

function on_playlists_changed() { // To show/hide loaded indicators...
	window.Repaint();
}

function on_notify_data(name, info) {
	switch (name) {
		case 'Playlist manager: playlistPath': {
			if (!info) {window.NotifyOthers('Playlist manager: playlistPath', list.playlistsPath);} // Share paths
			break;
		}
		case 'Playlist manager: get handleList': {
			if (info && info.length) {
				const plsName = info;
				if (list.hasPlaylists([plsName])) {
					window.NotifyOthers('Playlist manager: handleList', new Promise((resolve, reject) => {resolve(list.getHandleFromPlaylists([plsName], false));}));
				}
			} // Share paths
			break;
		}
		case 'precacheLibraryPaths': {
			libItemsAbsPaths = [...info];
			console.log('precacheLibraryPaths: using paths from another instance.');
			// Update rel paths if needed with new data
			if (list.bRelativePath && list.playlistsPath.length) {
				if (libItemsRelPaths.hasOwnProperty(list.playlistsPath) && libItemsRelPaths[list.playlistsPath].length !== libItemsAbsPaths.length) {
					libItemsRelPaths[list.playlistsPath] = []; // Delete previous cache on library change
				}
				precacheLibraryRelPaths(list.playlistsPath);
			}
			break;
		}
		case 'precacheLibraryPaths instances': {
			if (isArrayEqual(precacheLibraryPathsIds, info)) {return;}
			precacheLibraryPathsIds = [...new Set(info)].sort();
			window.NotifyOthers('precacheLibraryPaths instances', precacheLibraryPathsIds);
			break;
		}
	}
}

// function on_drag_over(action, x, y, mask) { // Tracks movement for index selecting inside the panel
	// if (cur_btn === null) {
		// list.move(x, y);
	// }
// }

// function on_drag_leave() {
	// on_mouse_leave_buttn();
	// list.onMouseLeaveList(); // Clears index selector
// }

// function on_drag_drop(action, x, y, mask) {
	// list.onDragDrop(); // Sends track to playlist file
// }

// Autosave
// Halt execution if trigger rate is greater than autosave (ms), so it fires only once after successive changes made.
// if Autosave === 0, then it does nothing...
var debouncedUpdate = (autoSaveTimer !== 0) ? debounce(list.updatePlaylist, autoSaveTimer) : null;
function on_playlist_items_reordered(playlistIndex) {
	debouncedUpdate ? debouncedUpdate(playlistIndex, true) : null;
}

function on_playlist_items_removed(playlistIndex) {
	debouncedUpdate ? debouncedUpdate(playlistIndex, true) : null;
}
  
function on_playlist_items_added(playlistIndex) {
	if (debouncedUpdate) {debouncedUpdate(playlistIndex, true);}
	else if (list.bAutoTrackTag && playlistIndex < plman.PlaylistCount) { // Double check playlist index to avoid crashes with callback delays and playlist removing
		if (list.bAutoTrackTagAlways) {list.updatePlaylistOnlyTracks(playlistIndex);}
		else if (plman.IsAutoPlaylist(playlistIndex)) {
			if (list.bAutoTrackTagAutoPls) {list.updatePlaylistOnlyTracks(playlistIndex);}
		} else if (list.bAutoTrackTagPls || list.bAutoTrackTagLockPls) {list.updatePlaylistOnlyTracks(playlistIndex);}
	}
}

function on_playlists_changed() { // For UI only playlists
	if (list.bAllPls) {
		list.update(true, true);
		const categoryState = [...new Set(list.categoryState).intersection(new Set(list.categories()))];
		list.filter({categoryState});
	}
}

// Auto-update if there are a different number of items on folder or the total file sizes change
// Note tracking it's not perfect... yes, you could change characters on a file without modifying size
// but that use-case makes no sense for playlists. These are not files with 'tags', no need to save timestamps or hashes.
// We double the timers here. First we create an interval and then a debounced func. We call the debounced func every X ms, 
// and since its timer is lower than the interval it fires before the next call is done. That's the regular use case.
// But we can also call the debounced func directly to delay it's execution (for ex. while updating files).
var debouncedAutoUpdate = (autoUpdateTimer) ? debounce(autoUpdate, autoUpdateTimer - 50) : null;
const autoUpdateRepeat = (autoUpdateTimer) ? repeatFn(debouncedAutoUpdate, autoUpdateTimer)() : null;
function delayAutoUpdate() {if (typeof debouncedAutoUpdate === 'function') {debouncedAutoUpdate();}} // Used before updating playlists to finish all changes
function autoUpdate() {
	const playlistPathArray = getFiles(getPropertyByKey(properties, 'playlistPath', prefix), loadablePlaylistFormats); // Workaround for win7 bug on extension matching with utils.Glob()
	const playlistPathArrayLength = playlistPathArray.length;
	if (playlistPathArrayLength !== (list.dataAll.length - list.itemsAutoplaylist)) { // Most times that's good enough. Count total items minus virtual playlists
		list.update(false, true, list.lastIndex);
		list.filter(); // Maintains focus on last selected item
		return true;
	} else { // Otherwise check size
		let totalFileSize = 0;
		for (let i = 0; i < playlistPathArrayLength; i++) {
			totalFileSize += isCompatible('1.4.0') ? utils.GetFileSize(playlistPathArray[i]) : utils.FileTest(playlistPathArray[i],'s'); //TODO: Deprecated
		}
		if (totalFileSize !== list.totalFileSize) { // User may have replaced a file with foobar executed
			list.update(false, true, list.lastIndex);
			list.filter(); // Updates with current filter (instead of showing all files when something changes) and maintains focus on last selected item
			return true;
		}
	}
	return false;
}