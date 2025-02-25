﻿'use strict';
//27/12/21

const kMask = {
	none: 0,
	ctrl: 1,
	shift: 2,
	ctrlShift: 3,
	ctrlAlt: 4,
	ctrlAltShift: 5,
	alt: 6
};

const buttonStates = {
	normal: 0,
	hover: 1,
	down: 2,
	hide: 3
};

function getKeyboardMask() {
	const c = utils.IsKeyPressed(VK_CONTROL) ? true : false;
	const a = utils.IsKeyPressed(VK_ALT) ? true : false;
	const s = utils.IsKeyPressed(VK_SHIFT) ? true : false;
	let ret = kMask.none;
	if (c && !a && !s) {ret = kMask.ctrl;}
	if (!c && !a && s) {ret = kMask.shift;}
	if (c && !a && s) {ret = kMask.ctrlShift;}
	if (c && a && !s) {ret = kMask.ctrlAlt;}
	if (c && a && s) {ret = kMask.ctrlAltShift;}
	if (!c && a && !s) {ret = kMask.alt;}
	return ret;
}