/*
	@author: SHIMODA Hiroshi aka Piro
	@url: http://piro.sakura.ne.jp/xul/observeclipboard/
	@title: Clipboard Observer Jetpack
	@version: 0.1.1.4.2009110201
*/

/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Clipboard Observer.
 *
 * The Initial Developer of the Original Code is SHIMODA Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2004-2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro@p.club.ne.jp>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
var ClipboardObserverService = { 

	interval : 100,

	timer : null,

	lastContent : null,
	lastURI : null,

	// properties 
	
	get schemer() 
	{
		return this._schemer;
	},
	set schemer(val)
	{
		this._schemer = val;

		this._schemers = this.schemer
			.replace(/([\(\)\+\.\{\}])/g, '\\$1')
			.replace(/\?/g, '.')
			.replace(/\*/g, '.+')
			.split(/[,\| \n\r\t]+/);
		this._schemerRegExp = null;

		this._kURIPattern = null;
		this._kURIPatternMultibyte = null;
		return val;
	},
	_schemer : '',
	get schemers()
	{
		return this._schemers.concat(this._fixupSchemers);
	},
	_schemers : [],
	_fixupSchemers : [],
 
	schemerFixupDefault : 'http', 
 
	get schemerFixupTable() 
	{
		return this._schemerFixupTable;
	},
	set schemerFixupTable(val)
	{
		this._schemerFixupTable = val;

		this._fixupTable = this._schemerFixupTable
					.replace(/(\s*[^:\s]+)\s*=>\s*([^:\s]+)(\s*([,\| \n\r\t]|$))/g, '$1:=>$2:$3');
		this._fixupTargets = this._fixupTable
					.replace(/\s*=>\s*[^,\| \n\r\t]+|\s*=>\s*[^,\| \n\r\t]+$/g, '')
					.replace(/([\(\)\+\.\{\}])/g, '\\$1')
					.replace(/\?/g, '.')
					.replace(/\*/g, '.+')
					.split(/\s*[,\| \n\r\t]+\s*/);
		this._fixupSchemers = this._fixupTargets
					.filter(function(aTarget) {
						return /:$/.test(aTarget);
					})
					.map(function(aTarget) {
						return aTarget.replace(/:$/, '');
					});
		this._fixupTargetsPattern = this._fixupTargets.join('|');
		this._fixupTargetsRegExp = new RegExp('^('+this._fixupTargetsPattern+')');

		this._schemerRegExp = null;

		this._kURIPattern = null;
		this._kURIPatternMultibyte = null;
		return val;
	},
	_schemerFixupTable : '',
 
	get shouldParseMultibyteCharacters() 
	{
		return this._shouldParseMultibyteCharacters;
	},
	set shouldParseMultibyteCharacters(val)
	{
		this._shouldParseMultibyteCharacters = val;
		this._schemerRegExp = null;
		this._URIMatchingRegExp = null;
		this._URIPartRegExp_start = null;
		this._URIPartRegExp_end = null;
		return val;
	},
	_shouldParseMultibyteCharacters : true,
 
  
// string operations 
	
	// from http://taken.s101.xrea.com/blog/article.php?id=510
	convertFullWidthToHalfWidth : function(aString) 
	{
		return aString.replace(this.fullWidthRegExp, this.f2h)
					.replace(/\u301c/g, '~'); // another version of tilde
	},
	fullWidthRegExp : /[\uFF01\uFF02\uFF03\uFF04\uFF05\uFF06\uFF07\uFF08\uFF09\uFF0A\uFF0B\uFF0C\uFF0D\uFF0E\uFF0F\uFF10\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16\uFF17\uFF18\uFF19\uFF1A\uFF1B\uFF1C\uFF1D\uFF1E\uFF1F\uFF20\uFF21\uFF22\uFF23\uFF24\uFF25\uFF26\uFF27\uFF28\uFF29\uFF2A\uFF2B\uFF2C\uFF2D\uFF2E\uFF2F\uFF30\uFF31\uFF32\uFF33\uFF34\uFF35\uFF36\uFF37\uFF38\uFF39\uFF3A\uFF3B\uFF3C\uFF3D\uFF3E\uFF3F\uFF40\uFF41\uFF42\uFF43\uFF44\uFF45\uFF46\uFF47\uFF48\uFF49\uFF4A\uFF4B\uFF4C\uFF4D\uFF4E\uFF4F\uFF50\uFF51\uFF52\uFF53\uFF54\uFF55\uFF56\uFF57\uFF58\uFF59\uFF5A\uFF5B\uFF5C\uFF5D\uFF5E]/g,
	f2h : function() {
		var str = arguments[0];
		var code = str.charCodeAt(0);
		code &= 0x007F;
		code += 0x0020;
		return String.fromCharCode(code);
	},

	convertHalfWidthToFullWidth : function(aString)
	{
		return aString.replace(this.halfWidthRegExp, this.h2f);
	},
	halfWidthRegExp : /[!"#$%&'\(\)\*\+,-\.\/0123456789:;<=>\?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\[\\\]\^_`abcdefghijklmnopqrstuvwxyz\{\|\}~]/g,
	h2f : function() {
		var str = arguments[0];
		var code = str.charCodeAt(0);
		code += 0xFF00;
		code -= 0x0020;
		return String.fromCharCode(code);
	},
  
	// URI manipulation (from textlink) 
	
	get kURIPattern() 
	{
		if (!this._kURIPattern) {
			this._kURIPattern = this.kURIPattern_base
				.replace(
					/%SCHEMER_PATTERN%/g,
					'('+this.schemers.join('|')+'):'
				)
				.replace(
					/%PART_PATTERN%/g,
					this.kURIPattern_part
				)
				.replace(
					/%DOMAIN_PATTERN%/g,
					'[0-9a-z\\.-]+\\.('+this.kTopLevelDomains.join('|')+')\\b'
				);
		}

		return this._kURIPattern;
	},
	_kURIPattern : null,
 
	get kURIPatternMultibyte() 
	{
		if (!this._kURIPatternMultibyte) {
			this._kURIPatternMultibyte = this.kURIPatternMultibyte_base
				.replace(
					/%SCHEMER_PATTERN%/g,
					'('+
					this.schemers.map(function(aSchemer) {
						return aSchemer+'|'+this.convertHalfWidthToFullWidth(aSchemer);
					}, this).join('|')+
					')[:\uff1a]'
				)
				.replace(
					/%PART_PATTERN%/g,
					this.kURIPatternMultibyte_part
				)
				.replace(
					/%DOMAIN_PATTERN%/g,
					'[0-9a-z\\.-]+[\\.]('+this.kTopLevelDomains.join('|')+')\\b'
/*
					'[0-9a-z\\.-\uff10-\uff19\uff41-\uff5a\uff21-\uff3a\uff0e\uff0d]+[\\.\uff0e]('+
					this.kTopLevelDomains.join('|')+
					'|'+
					this.convertHalfWidthToFullWidth(this.kTopLevelDomains.join('|')).replace(/\uff5c/g, '|')+
					')'
*/
				);
		}

		return this._kURIPatternMultibyte;
	},
	_kURIPatternMultibyte : null,
 
	kURIPattern_base : '\\(?(%SCHEMER_PATTERN%(//)?%PART_PATTERN%|%DOMAIN_PATTERN%(/%PART_PATTERN%)?)', 
	kURIPatternMultibyte_base : '[\\(\uff08]?(%SCHEMER_PATTERN%(//|\uff0f\uff0f)?%PART_PATTERN%|%DOMAIN_PATTERN%([/\uff0f]%PART_PATTERN%)?)',

	kSchemerPattern : '[\\*\\+a-z0-9_]+:',
	kSchemerPatternMultibyte : '[\\*\\+a-z0-9_\uff41-\uff5a\uff21-\uff3a\uff10-\uff19\uff3f]+[:\uff1a]',

	kURIPattern_part : '[-_\\.!~*\'()a-z0-9;/?:@&=+$,%#]+',
	kURIPatternMultibyte_part : '[-_\\.!~*\'()a-z0-9;/?:@&=+$,%#\u301c\uff0d\uff3f\uff0e\uff01\uff5e\uffe3\uff0a\u2019\uff08\uff09\uff41-\uff5a\uff21-\uff3a\uff10-\uff19\uff1b\uff0f\uff1f\uff1a\uff20\uff06\uff1d\uff0b\uff04\uff0c\uff05\uff03]+',

	// http://www4.plala.or.jp/nomrax/TLD/
	// http://ja.wikipedia.org/wiki/%E3%83%88%E3%83%83%E3%83%97%E3%83%AC%E3%83%99%E3%83%AB%E3%83%89%E3%83%A1%E3%82%A4%E3%83%B3%E4%B8%80%E8%A6%A7
	kTopLevelDomains : [
		// gTLD
		'aero',
		'arpa',
		'asia',
		'biz',
		'cat',
		'com',
		'coop',
		'edu',
		'gov',
		'info',
		'int',
		'jobs',
		'mil',
		'mobi',
		'museum',
		'name',
		'nato',
		'net',
		'org',
		'pro',
		'tel',
		'travel',

		// ccTLD
		'ac',
		'ad',
		'ae',
		'af',
		'ag',
		'ai',
		'al',
		'am',
		'an',
		'ao',
		'aq',
		'ar',
		'as',
		'at',
		'au',
		'aw',
		'ax',
		'az',
		'ba',
		'bb',
		'bd',
		'be',
		'bf',
		'bg',
		'bh',
		'bi',
		'bj',
		'bm',
		'bn',
		'bo',
		'br',
		'bs',
		'bt',
		'bv',
		'bw',
		'by',
		'bz',
		'ca',
		'cc',
		'cd',
		'cf',
		'cg',
		'ch',
		'ci',
		'ck',
		'cl',
		'cm',
		'cn',
		'co',
		'cr',
		'cs',
		'cu',
		'cv',
		'cx',
		'cy',
		'cz',
		'dd',
		'de',
		'dj',
		'dk',
		'dm',
		'do',
		'dz',
		'ec',
		'ee',
		'eg',
		'eh',
		'er',
		'es',
		'et',
		'eu',
		'fi',
		'fj',
		'fk',
		'fm',
		'fo',
		'fr',
		'ga',
		'gb',
		'gd',
		'ge',
		'gf',
		'gg',
		'gh',
		'gi',
		'gl',
		'gm',
		'gn',
		'gp',
		'gq',
		'gr',
		'gs',
		'gt',
		'gu',
		'gw',
		'gy',
		'hk',
		'hm',
		'hn',
		'hr',
		'ht',
		'hu',
		'id',
		'ie',
		'il',
		'im',
		'in',
		'io',
		'iq',
		'ir',
		'is',
		'it',
		'je',
		'jm',
		'jo',
		'jp',
		'ke',
		'kg',
		'kh',
		'ki',
		'km',
		'kn',
		'kp',
		'kr',
		'kw',
		'ky',
		'kz',
		'la',
		'lb',
		'lc',
		'li',
		'lk',
		'lr',
		'ls',
		'lt',
		'lu',
		'lv',
		'ly',
		'ma',
		'mc',
		'md',
		'me',
		'mg',
		'mh',
		'mk',
		'ml',
		'mm',
		'mn',
		'mo',
		'mp',
		'mq',
		'mr',
		'ms',
		'mt',
		'mu',
		'mv',
		'mw',
		'mx',
		'my',
		'mz',
		'na',
		'nc',
		'ne',
		'nf',
		'ng',
		'ni',
		'nl',
		'no',
		'np',
		'nr',
		'nu',
		'nz',
		'om',
		'pa',
		'pe',
		'pf',
		'pg',
		'ph',
		'pk',
		'pl',
		'pm',
		'pn',
		'pr',
		'ps',
		'pt',
		'pw',
		'py',
		'qa',
		're',
		'ro',
		'rs',
		'ru',
		'rw',
		'sa',
		'sb',
		'sc',
		'sd',
		'se',
		'sg',
		'sh',
		'si',
		'sj',
		'sk',
		'sl',
		'sm',
		'sn',
		'so',
		'sr',
		'st',
		'su',
		'sv',
		'sy',
		'sz',
		'tc',
		'td',
		'tf',
		'tg',
		'th',
		'tj',
		'tk',
		'tl',
		'tm',
		'tn',
		'to',
		'tp',
		'tr',
		'tt',
		'tv',
		'tw',
		'tz',
		'ua',
		'ug',
		'uk',
		'um',
		'us',
		'uy',
		'uz',
		'va',
		'vc',
		've',
		'vg',
		'vi',
		'vn',
		'vu',
		'wf',
		'ws',
		'ye',
		'yt',
		'yu',
		'za',
		'zm',
		'zr',
		'zw'
	],
 
	matchURIRegExp : function(aString) 
	{
		this._updateURIRegExp();
		return aString.match(this._URIMatchingRegExp);
	},
	isHeadOfNewURI : function(aString)
	{
		this._updateURIRegExp();
		var match = aString.match(this._URIMatchingRegExp_fromHead);
		match = match ? match[1] : '' ;
		return this.hasLoadableSchemer(match) ? match == aString : false ;
	},
	_URIMatchingRegExp : null,
	_URIMatchingRegExp_fromHead : null,
	_updateURIRegExp : function()
	{
		if (this._URIMatchingRegExp) return;
		var regexp;
		if (this.shouldParseMultibyteCharacters) {
			this._URIMatchingRegExp_fromHead = new RegExp(this.kURIPatternMultibyte, 'i');
			regexp = this.kURIPatternMultibyte;
		}
		else {
			this._URIMatchingRegExp_fromHead = new RegExp(this.kURIPattern, 'i');
			regexp = this.kURIPattern;
		}
		this._URIMatchingRegExp = new RegExp(regexp, 'ig');
	},
 
	hasLoadableSchemer : function(aURI) 
	{
		if (!this._schemerRegExp) {
			var schemers = this.schemers;
			var colon = ':';
			if (this.shouldParseMultibyteCharacters) {
				schemers = schemers.map(function(aSchemer) {
						return aSchemer+'|'+this.convertHalfWidthToFullWidth(aSchemer);
					}, this);
				colon = '[:\uff1a]';
			}
			this._schemerRegExp = new RegExp('^('+this.schemers.join('|')+')'+colon, 'i');
		}
		return this._schemerRegExp.test(aURI);
	},
	_schemerRegExp : null,
 
	hasSchemer : function(aInput) 
	{
		return this._firstSchemerRegExp.test(aInput);
	},
	removeSchemer : function(aInput)
	{
		return aInput.replace(this._firstSchemerRegExp, '');
	},
	get _firstSchemerRegExp()
	{
		if (!this.__firstSchemerRegExp) {
			this.__firstSchemerRegExp = new RegExp('^'+this.kSchemerPatternMultibyte, 'i');
		}
		return this.__firstSchemerRegExp;
	},
	__firstSchemerRegExp : null,
 
	fixupURI : function(aURIComponent) 
	{
		if (this.shouldParseMultibyteCharacters) {
			aURIComponent = this.convertFullWidthToHalfWidth(aURIComponent);
		}

		aURIComponent = this.sanitizeURIString(aURIComponent);
		if (!aURIComponent) {
			return null;
		}

		aURIComponent = this.fixupSchemer(aURIComponent);

		return this.hasLoadableSchemer(aURIComponent) ? aURIComponent : null ;
	},
	
	sanitizeURIString : function(aURIComponent) 
	{
		// escape patterns like program codes like JavaScript etc.
		if (!this._topLevelDomainsRegExp) {
			this._topLevelDomainsRegExp = new RegExp('^(' + this.kTopLevelDomains.join('|') + ')$');
		}
		if (this.shouldParseRelativePath) {
			if (
				(
					aURIComponent.match(/^([^\/\.]+\.)+([^\/\.]+)$/) &&
					!RegExp.$2.match(this._topLevelDomainsRegExp)
				) ||
				aURIComponent.match(/(\(\)|\([^\/]+\)|[;\.,])$/)
				)
				return '';
		}

		aURIComponent = this.removeParen(aURIComponent);

		while (
			aURIComponent.match(/^\((.*)$/) ||
			aURIComponent.match(/^([^\(]*)\)$/) ||
			aURIComponent.match(/^(.*)[\.,]$/) ||
			aURIComponent.match(/^([^\"]*)\"$/) ||
			aURIComponent.match(/^([^\']*)\'$/) ||
			aURIComponent.match(/^(.+)\s*\([^\)]+$/) ||
			aURIComponent.match(/^[^\(]+\)\s*(.+)$/) ||
			aURIComponent.match(/^[^\.\/:]*\((.+)\)[^\.\/]*$/) ||
			(
				!this.shouldParseRelativePath &&
				aURIComponent.match(/^[\.\/:](.+)$/)
			)
			) {
			aURIComponent = RegExp.$1;
		}

		aURIComponent = this.removeParen(aURIComponent);

		return aURIComponent; // aURIComponent.replace(/^.*\((.+)\).*$/, '$1');
	},
	_topLevelDomainsRegExp : null,
 
	removeParen : function(aInput) 
	{
		var doRemoveParen = function(aRegExp) {
				let match = aInput.match(aRegExp);
				if (!match) return false;
				aInput = match[1];
				return true;
			};
		while (this._parenPatterns.some(doRemoveParen)) {}
		return aInput;
	},
	_parenPatterns : [
		/^["\u201d\u201c\u301d\u301f](.+)["\u201d\u201c\u301d\u301f]$/,
		/^[`'\u2019\u2018](.+)[`'\u2019\u2018]$/,
		/^[(\uff08](.+)[)\uff09]$/,
		/^[{\uff5b](.+)[}\uff5d]$/,
		/^[\[\uff3b](.+)[\]\uff3d]$/,
		/^[<\uff1c](.+)[>\uff1e]$/,
		/^[\uff62\u300c](.+)[\uff63\u300d]$/,
		/^\u226a(.+)\u226b$/,
		/^\u3008(.+)\u3009$/,
		/^\u300a(.+)\u300b$/,
		/^\u300e(.+)\u300f$/,
		/^\u3010(.+)\u3011$/,
		/^\u3014(.+)\u3015$/,
		/^(.+)["\u201d\u201c\u301d\u301f][^"\u201d\u201c\u301d\u301f]*$/,
		/^(.+)[`'\u2019\u2018][^`'\u2019\u2018]*$/,
		/^(.+)[(\uff08][^)\uff09]*$/,
		/^(.+)[{\uff5b][^}\uff5d]*$/,
		/^(.+)[\[\uff3b][^\]\uff3d]*$/,
		/^(.+)[<\uff1c][^>\uff1e]*$/,
		/^(.+)[\uff62\u300c][^\uff63\u300d]*$/,
		/^(.+)\u226a[^\u226b$]*/,
		/^(.+)\u3008[^\u3009$]*/,
		/^(.+)\u300a[^\u300b$]*/,
		/^(.+)\u300e[^\u300f$]*/,
		/^(.+)\u3010[^\u3011$]*/,
		/^(.+)\u3014[^\u3015$]*/
	],
 
	fixupSchemer : function(aURI) 
	{
		var match = aURI.match(this._fixupTargetsRegExp);
		if (match) {
			var target = match[1];
			var table = eval('(function() {'+
					'var table = '+this._fixupTable.quote()+';'+
					'var target = '+target.quote()+';'+
					((this._fixupTargetsPattern+'|')
						.replace(
							/([^|]+)\|/g,
							<![CDATA[
								if (/^$1$/.test(target))
									table = table.replace(/\b$1\s*=>/, target+"=>");
							]]>
						))+
					'return table;'+
				'})()');
			match = table.match(new RegExp(
					'(?:[,\\| \\n\\r\\t]|^)'+
					target.replace(/([\(\)\+\?\.\{\}])/g, '\\$1')
						.replace(/\?/g, '.')
						.replace(/\*/g, '.+')+
					'\\s*=>\\s*([^,\\| \\n\\r\\t]+)'
				));
			if (match)
				aURI = aURI.replace(target, match[1]);
		}
		else if (!this._firstSchemerRegExp.test(aURI)) {
			var schemer = this.schemerFixupDefault;
			if (schemer)
				aURI = schemer+'://'+aURI;
		}

		return aURI;
	},
	_fixupTable : null,
	_fixupTargets : null,
	_fixupTargetsPattern : null,
	_fixupTargetsRegExp : null,
   



	get clipboardContent()
	{
		return jetpack.clipboard.get('text/unicode');
	},

	getURIsFromClipboard : function() 
	{
		var res = [];
		var done = {};
		try {
			var str = this.clipboardContent;
			if (!str) return res;

			// is the string an URI?
			var uris = this.matchURIRegExp(str);
			if (!uris.length) return res;

			var uri;
			for (var i in uris)
			{
				uri = this.fixupURI(uris[i]);
				if (uri && !(uri in done)) {
					res.push(uri);
					done[uri] = true;
				}
			}
		}
		catch(e) {
		}
		return res;
	},

	observes : function() 
	{
		var sv = ClipboardObserverService;
		if (sv.lastContent.observingNow) return;

		sv.lastContent.observingNow = true;

		var clipboardContent = sv.clipboardContent;
		if (sv.lastContent.shouldIgnoreFirst) {
			sv.lastContent.shouldIgnoreFirst = false;
			sv.lastContent.observingNow = false;
		}
		if (sv.lastContent.value == clipboardContent)
			sv.lastContent.observingNow = false;

		sv.lastContent.value = clipboardContent;
		if (!sv.lastContent.observingNow)
			return;

		var uris = sv.getURIsFromClipboard();

		if (
			!uris.length ||
			sv.lastURI.indexOf(uris.join('|')) > -1
			) {
			sv.lastContent.observingNow = false;
			return;
		}


		if (uris.length > 1 &&
			sv.modeMultiple == 0)
			uris = [uris[0]];

		if (uris.length == 1 &&
			jetpack.tabs.some(function(aTab) {
				return aTab.url == uris[0];
			})) {
			sv.lastContent.observingNow = false;
			return;
		}


		sv.lastURI = uris.join('|');

		var firstTab;
		uris.forEach(function(aURI, aIndex) {
			if (!aIndex && jetpack.tabs.focused.url == 'about:blank') {
				jetpack.tabs.focused.contentWindow.location.href = aURI;
				if (!firstTab) firstTab = jetpack.tabs.focused;
			}
			else {
				var tab = jetpack.tabs.open(aURI);
				if (!firstTab) firstTab = tab;
			}
		});
		if (firstTab) firstTab.focus();

		sv.lastContent.observingNow = false;
	},
 

	start : function()
	{
		if (this.timer) return;

		this.lastURI = '';
		this.lastContent = {
			value             : '',
			shouldIgnoreFirst : (this.clipboardContent ? true : false ),
			observingNow      : false
		};

		this.timer = setInterval(this.observes, this.interval);
	},

	stop : function() 
	{
		if (!this.timer) return;
		clearInterval(this.timer);
		this.timer = null;
	}
}; 
 

ClipboardObserverService.schemer = 'http https ftp news nntp telnet irc mms ed2k about file urn chrome resource';
ClipboardObserverService.schemerFixupTable = 'www=>http://www ftp.=>ftp://ftp. irc.=>irc:irc. h??p=>http h???s=>https ttp=>http tp=>http p=>http ttps=>https tps=>https ps=>https';
ClipboardObserverService.shouldParseMultibyteCharacters = true;


jetpack.future.import("clipboard");

jetpack.statusBar.append({
	html: '<label><input type="checkbox" checked="true" />Observe Clipboard</label>',
	width : 130,
	onReady: function(aWidget){
		$('input', aWidget).click(function(){
			if (this.checked)
				ClipboardObserverService.start();
			else
				ClipboardObserverService.stop();
		});
	}
});

ClipboardObserverService.start();
