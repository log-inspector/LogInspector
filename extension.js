const vscode = require('vscode');
var logEditor = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	let disposable2 = vscode.commands.registerCommand('loginspector.readLog', function () {
		try {
		if (!vscode.window.activeTextEditor) {
			vscode.window.showWarningMessage( "No active text editor. Extensions do not work on larger files." );
			return;
		}

		const editor = vscode.window.activeTextEditor;
		const selection = editor.selection;
		var text = editor.document.getText(selection);

		if ( text.length === 0 ) {
			var word = editor.document.getWordRangeAtPosition( selection.start );
			if ( !word ) {
				return;
			}
			text = editor.document.getText( word );
		}

		if ( !editor.document.fileName.endsWith( ".log" ) ) {
			return;
		}

		const configuration = vscode.workspace.getConfiguration( "logInspector" );
		// var regExStart = /^[0-9]{4}-[0-1][0-9]-[0-3][0-9]/;
		var regExStart = new RegExp( configuration.lineStart );

		vscode.window.activeTextEditor.edit(editBuilder => {
			// editBuilder.replace(new vscode.Range(0,0,1,0), text + "\n");
			var lc = editor.document.lineCount;
			var keepContinuation = false;
			for (var i = 0; i < lc; ++i) {
				let line = editor.document.lineAt(i);

				if ( keepContinuation && !line.text.match( regExStart ) ) {
					continue;
				}
				else {
					keepContinuation = false;
				}

				if (!line.text.includes(text)) {
					editBuilder.replace(new vscode.Range(i, 0, i + 1, 0), "");
				}
				else {
					keepContinuation = true;
				}
			}
		})

		}
		catch (error) {
			console.log( error );
			vscode.window.showErrorMessage( error.message );
		}
	});

	let disposable3 = vscode.commands.registerCommand('loginspector.matchFunction', function () {
		if (!vscode.window.activeTextEditor) {
			vscode.window.showWarningMessage( "No active text editor. Extensions do not work on larger files." );
			return;
		}
		// console.log("have editor");

		const editor = vscode.window.activeTextEditor;
		const selection = editor.selection;
		// const text = editor.document.getText(selection);
		// console.log( "selection" );

		var lc = editor.document.lineCount;
		var line = selection.start.line;
		var startLine = line;

		const configuration = vscode.workspace.getConfiguration( "logInspector" );
		var regExLine = new RegExp( configuration.lineRegex );
		var regExIgnore = /\(.*\)/;
		var truncateLine = configuration.truncateLine;

		let text = editor.document.lineAt( line ).text;
		let match = text.match( regExLine );
		if ( !match ) {
			vscode.window.showWarningMessage( "The selected line does not match the regex" );
			return;
		}

		var startKeyword = configuration.beginKeyword;
		var endKeyword   = configuration.endKeyword;
		var searchForward = true;
		var position = findKeyword( match.groups.body, startKeyword );
		if ( position === -1 ) {
			// console.log( "try back" );
			position = findKeyword( match.groups.body, endKeyword );
			searchForward = false;
			startKeyword = configuration.endKeyword;
			endKeyword   = configuration.beginKeyword;
		}

		if ( position === -1 ) {
			vscode.window.showWarningMessage( "Begin or end keywords not found on given line" );
			return; // no begin or end at line
		}
		var startDate = new Date( match.groups.date );

		var name, back, original;
		var done = false;

		var stack = [];
		original = match.groups.body.slice(0, position);
		original = original.replace( regExIgnore, "" );
		// console.log( original );
		stack.push( original );
		var limit = searchForward ? lc : -1;
		line = line + ( searchForward ? 1 : -1 );
		// console.log( "start " + startKeyword + " end " + endKeyword + " forward " + searchForward );
		while ( line !== limit ) {
			text = editor.document.lineAt( line ).text;
			if ( text.length > truncateLine ) {
				text = text.slice( 0, truncateLine );
			}
			match = text.match( regExLine );
			if ( !match ) { // a continuation line				
				line = line + ( searchForward ? 1 : -1 );
				continue;
			}

			position = findKeyword( match.groups.body, startKeyword );
			if ( position !== -1 ) {
				name = match.groups.body.slice(0, position);
				name = name.replace( regExIgnore, "" );

				stack.push( name );
				// console.log( "push at line: " + (line+1) + " - " + name ); // line+1 to match line count in editor...
			}
			
			position = findKeyword( match.groups.body, endKeyword );
			if ( position !== -1 ) {
				name = match.groups.body.slice(0, position);
				name = name.replace( regExIgnore, "" );

				if ( stack.indexOf( name ) === -1 ) {
					// No start for this end - so ignore it
					line = line + ( searchForward ? 1 : -1 );
					continue;
				}

				while ( stack.length ) {
					back = stack.pop();
					// console.log( "pop  at line: " + (line+1) + " - " + back );
					if ( back === name ) {
						break;
					}
				}
			}
			if ( stack.length === 0 ) {
				var endDate = new Date( match.groups.date );
				var duration = ( endDate.valueOf() - startDate.valueOf() ) / 1000;
				if ( !searchForward ) {
					duration = duration * -1;
				}

				if ( name === original ) {
					// console.log( "found end at line: " + (line+1) );
					vscode.window.showInformationMessage( "found " + endKeyword + " at line: " + (line+1) + " - duration: " + duration + "s" );
				}
				else {
					// console.log( "closed because another end at: " + (line+1) );
					vscode.window.showInformationMessage( "closed because another " + endKeyword + " at: " + (line+1) + " - duration: " + duration + "s" );
				}
	
				if ( searchForward ) {
					editor.selection = new vscode.Selection( startLine, 0, line+1, 0 );
				}
				else {
					editor.selection = new vscode.Selection( line, 0, startLine+1, 0 );
				}
	
				done = true;
				break;
			}
			line = line + ( searchForward ? 1 : -1 );
		}
		if ( !done ) {
			// console.log( "Failed to find end before end of file" );
			vscode.window.showInformationMessage( "Failed to find end before end of file" );
		}
	});

	let disposable4 = vscode.commands.registerCommand('loginspector.draw', function () {
		try {
			drawFlame( false );
		}
		catch ( error ) {
			console.log( error );
			vscode.window.showErrorMessage( error.message );
		}
	});
	let drawCluster = vscode.commands.registerCommand('loginspector.drawCluster', function () {
		try {
			drawFlame( true, context.subscriptions );
		}
		catch ( error ) {
			console.log( error );
			vscode.window.showErrorMessage( error.message );
		}
	});
	let drawLine = vscode.commands.registerCommand('loginspector.drawFromLine', function () {
		try {
			if (!vscode.window.activeTextEditor) {
				vscode.window.showWarningMessage( "No active text editor. Extensions do not work on larger files." );
				return;
			}
			const editor = vscode.window.activeTextEditor;
			const selection = editor.selection;
			var line = selection.start.line;

			drawFlame( false, context.subscriptions, line - 1 );
		}
		catch ( error ) {
			console.log( error );
			vscode.window.showErrorMessage( error.message );
		}
	});

	// let disposable5 = vscode.commands.registerCommand('loginspector.hide', function () {
	// 	try {
	// 		const editor = vscode.window.activeTextEditor;

	// 	}
	// 	catch ( error ) {
	// 		console.log( error );
	// 		vscode.window.showErrorMessage( error.message );
	// 	}

	// });

	context.subscriptions.push(disposable2);
	context.subscriptions.push(disposable3);
	context.subscriptions.push(disposable4);
	// context.subscriptions.push(disposable5);
	context.subscriptions.push( drawCluster );
	context.subscriptions.push( drawLine );
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}

function drawFlame( lastGroup, sub, startLine ) 
{
	if (!vscode.window.activeTextEditor) {
		vscode.window.showWarningMessage( "No active text editor. Extensions do not work on larger files." );
		return;
	}
	logEditor = vscode.window.activeTextEditor;

	var startTime = Date.now();
	var panel = vscode.window.createWebviewPanel( "log_graph", "title", { viewColumn: vscode.ViewColumn.Beside }, { enableScripts: true } );
	vscode.commands.executeCommand( 'vscode.setEditorLayout', { orientation: 0, groups: [{ size: 0.7 }, { size: 0.3 }] } );

	var data;
	if ( lastGroup ) {
		var clusterStart = findClusterStart();
		data = createData( true, clusterStart );
	}
	else {
		data = createData( true, Number.isInteger( startLine ) ? startLine : null );
	}
	
	var dataTime = Date.now();
	// vscode.window.showInformationMessage( 'Create data time: ' + ( dataTime - startTime ) + "ms" );
	console.log( 'Create data time: ' + ( dataTime - startTime ) + "ms" );

	panel.webview.html = getPage( data );
	var drawnTime = Date.now();
	// vscode.window.showInformationMessage( 'Draw data time: ' + ( drawnTime - dataTime ) + "ms" );
	console.log( 'Draw data time: ' + ( drawnTime - dataTime ) + "ms" );


	panel.webview.onDidReceiveMessage(
		message => {
			switch (message.command) {
				case 'goto':
					var line = parseInt( message.text );
					if ( !isNaN( line ) ) {
						// if ( !logEditor ) { even if editor disposed, no crash }
						logEditor.revealRange( new vscode.Range( line, 0, line+1, 0 ), vscode.TextEditorRevealType.InCenter );
						logEditor.selection =  new vscode.Selection( line, 0, line+1, 0 );
					}
					else {
						console.log( "error" );
					}
					  return;
			}
		},
		undefined,
		sub
	);
}

function findClusterStart()
{
	var ret = -1;
	const editor = vscode.window.activeTextEditor;

	var lc = editor.document.lineCount;

	const configuration = vscode.workspace.getConfiguration( "logInspector" );
	var regExLine = new RegExp( configuration.lineRegex );
	var truncateLine = configuration.truncateLine;

	var text, match, date, lastDate = -1;

	line = lc;
	while ( --line > 0 ) {
		// console.log( line );
		text = editor.document.lineAt( line ).text;
		match = text.match( regExLine );
		if ( !match ) {
			continue;
		}
		date = (new Date( match.groups.date )).valueOf() / 1000;
		if ( lastDate < 0 ) {
			lastDate = date;
		}
		else if ( date < lastDate - 1 ) { // more than 1 second difference
			ret = line;
			break;
		}
	}
	return ret;
}

function getPage( data ) {
	// console.log( drawGraph( data ) );
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Cat Coding</title>
		<style>
		` + getCss() + `
		</style>
		<script type="text/javascript">
		` + getJS() + `
		</script>
    </head>
	<body>
		<div id="root" class="la-root">
		` + drawGraph( data ) + `
		</div>
    </body>
    </html>`;
}

function getCss()
{
	var css = `
	.la-root {
		position : relative; 
		width : 1000px;
		height : 1000px;
		will-change: width;
	}
	.la-block {
		border : 1px solid;
		position : absolute;
		border-radius : 2px;
	}
	.la-data {
		visibility : hidden;
		background : black;
		position : sticky;
		left : 5px;
		margin-top : 20px;
		z-index : 1;
		width : min-content;
		padding : 5px;
		border-radius : 5px;
		border : 1px solid;
		white-space: pre;
	}
	.la-block:hover > * {
		visibility: visible;
		pointer-events : none;
	}
	p {
		margin : 0;
	}`;
	return css;
}

function getJS()
{
	const configuration = vscode.workspace.getConfiguration( "logInspector" );

	var down = "*", up = "/";
	if ( configuration.invertScroll ) {
		down = "/";
		up = "*";
	}
	var js = `			
		window.onload = function() {
		console.log( "on load" );
		var root = document.getElementById("root");
		document.rootWidth = 1000;

		document.addEventListener('wheel', onScroll);
		function onScroll( ev ) 
		{
			if ( !document.zooming ) {
				return;
			}
			if ( ev.deltaX !== 0 ) {
				return;
			}
			var factor = 1;
			if ( ev.deltaY < 0 ) {
				factor = 1 ${down} 1.1;
			}
			else if ( ev.deltaY > 0 ) {
				factor = 1 ${up} 1.1;
			}
			else {
				return;
			}

			ev.preventDefault();
			ev.stopPropagation();
			zoom( factor, ev.x );
		}

		document.addEventListener('keydown', logKey);
		function logKey(e) {
			if ( e.code === "ArrowUp" || e.code === "ArrowDown" ) {
				zoom( e.code === "ArrowDown" ? 1 / 1.2 : 1.2 );

				e.preventDefault();
				e.stopPropagation();
			}
			if ( e.key === "Control" || e.key === "Meta" ) {
				document.zooming = true;
				document.addEventListener('wheel', preventDefault, {passive: false});
			}
		}
		document.addEventListener('keyup', onKeyUp);
		function onKeyUp( e ) {
			if ( e.key === "Control" || e.key === "Meta" ) {
				document.zooming = false;
				document.removeEventListener('wheel', preventDefault, {passive: false});
			}
		}

		function zoom( factor, stableX ) 
		{
			if ( document.rootWidth * factor < 100 || document.rootWidth * factor > 1000000 ) {
				return; // prevent extreemes
			}

			var root = document.getElementById("root");
			if ( !stableX ) {
				var w = root.parentNode.offsetWidth;
				stableX = w / 2;
			}
			var center = root.parentNode.parentElement.scrollLeft + stableX;
			var newCenter = center * factor;
			var newLeft = newCenter - stableX;

			document.rootWidth = document.rootWidth * factor;
			root.style.width = document.rootWidth + "px";
			root.parentNode.parentElement.scrollLeft = newLeft;
		}

		function preventDefault(e) {
			e = e || window.event;
			if (e.preventDefault)
				e.preventDefault();
			e.returnValue = false;  
		}

		document.vscode = acquireVsCodeApi();

		function sendMessage( line ) {
			document.vscode.postMessage( {
				command: 'goto',
				text: line
			} );
		}

		document.addEventListener( 'click', onClick );
		function onClick( ev ) {
			var target = ev.target;
			var line = ev.target.getAttribute( "line" );
			if ( line ) {
				sendMessage( line );
			}
		}

		var slider = document.getElementById("root");
		let isDown = false;
		let startX;
		let scrollLeft, prevLeft;
		let momentum = 0;
		var timeout = null;

		document.addEventListener('mousedown', (e) => {
			isDown = true;
			momentum = 0;
			if ( timeout ) {
				window.clearTimeout( timeout );
				timeout = null;
			}
			startX = e.clientX;
			scrollLeft = slider.parentNode.parentElement.scrollLeft;
			prevLeft = scrollLeft;
		});
		document.addEventListener('mouseleave', stopScroll );
		document.addEventListener('mouseup', stopScroll );

		document.addEventListener('mousemove', (e) => {
			if(!isDown) return;
			e.preventDefault();
			const x = e.clientX;
			const walk = (x - startX);
			const diff = ( prevLeft - ( scrollLeft - walk ) );
			momentum = ( momentum + diff ) / 2;
			slider.parentNode.parentElement.scrollLeft = scrollLeft - walk;
			prevLeft = scrollLeft - walk;
			console.log(walk);
		});

		function stopScroll() {
			isDown = false;
			if ( Math.abs( momentum ) > 2 ) {
				timeout = window.setTimeout( applyMomentum, 33 );
			}
		}

		function applyMomentum() {
			momentum = momentum * 0.9;
			slider.parentNode.parentElement.scrollLeft = prevLeft - momentum;
			prevLeft = prevLeft - momentum;

			if ( Math.abs( momentum ) < 1.5 ) {
				momentum = 0;
				timeout = null;
			}
			else {
				timeout = window.setTimeout( applyMomentum, 33 );
			}
		}
	}`;
	return js;
}

function drawGraph( data )
{
	// console.log( data );
	var str = "";
	var total = ( data.max - data.min ) / 100; // incorporate max width
	for ( let el of data.calls ) {
		str += drawBlock( el, data.min, total, 0 );
	}
	return str;
}

function drawBlock( data, min, total, level )
{
	var str = "";
	var height = 20;
	var top = level * height;
	var width = ( data.end - data.start ) / total;
	var left = ( data.start - min ) / total;
	var color = [ "#cc0000", "#008000", "#0000cc" ][ level % 3 ];
	str += '<div style="top:' + top
				 + 'px; left:' + left 
				 + '%;  height:' + height 
				 + 'px; width:' + width 
				 + '%;  background:' + color + '" class="la-block" line="' + data.line + '">'
				 + drawData( data )
				 + '</div>\n'

	var calls = data.calls || [];
	for ( let el of calls ) {
		str += drawBlock( el, min, total, level+1 );
	}
	return str;
}

function drawData( data ) {
	var str = '<div class="la-data">';
	str += '' + data.name + '\n';
	str += 'start: ' + data.start.toFixed( 3 ) + '\n';
	str += 'end  : ' + data.end.toFixed( 3 ) + '\n';
	str += 'time : ' + (data.end - data.start).toFixed( 3 ) + '\n';
	str += 'line : ' + (data.line+1) + '';

	str += '</div>';
	return str;
}

function createData( useDates, startLine )
{
	if ( !Number.isInteger( startLine ) ) {
		startLine = -1;
	}
	// console.log( "create data" );
	const editor = vscode.window.activeTextEditor;

	var lc = editor.document.lineCount;
	var line = startLine;

	const configuration = vscode.workspace.getConfiguration( "logInspector" );
	var regExLine = new RegExp( configuration.lineRegex );
	var regExIgnore = /\(.*\)/;

	var truncateLine = configuration.truncateLine;

	var text, match, position, name, back, unmatchedEnd, obj;

	var ret = { calls : [], min : 0, max : lc };
	if ( useDates ) {
		console.log( "get bounds" );
		while ( ++line < lc ) {
			// console.log( line );
			text = editor.document.lineAt( line ).text;
			match = text.match( regExLine );
			if ( !match ) {
				continue;
			}
			ret.min = (new Date( match.groups.date )).valueOf() / 1000;
			break;
		}
		console.log( "min: " + ret.min );
		line = lc;
		while ( --line > 0 ) {
			// console.log( line );
			text = editor.document.lineAt( line ).text;
			match = text.match( regExLine );
			if ( !match ) {
				continue;
			}
			ret.max = (new Date( match.groups.date )).valueOf() / 1000;
			break;
		}
		console.log( "max: " + ret.max );
		line = startLine;
	}

	var ignored = new Set();
	var matchedBegins = new Set();
	var stack = [];
	var stackNames = [];
	while ( ++line < lc ) {
		// console.log( "line: ", line );
		text = editor.document.lineAt( line ).text;
		if ( text.length > truncateLine ) {
			text = text.slice( 0, truncateLine );
		}
		// console.log( "text 2" );

		match = text.match( regExLine );
		if ( !match ) { // a continuation line
			continue;
		}

		position = findKeyword( match.groups.body, configuration.beginKeyword );
		if ( position !== -1 ) {
			name = match.groups.body.slice(0, position);
			name = name.replace( regExIgnore, "" );

			obj = { "name" : name, "start" : line, "calls" : [], "line" : line };
			if ( useDates ) {
				obj.start = (new Date( match.groups.date )).valueOf() / 1000 - ret.min;
			}
			stack.push( obj );
			stackNames.push( name );
		}
		
		position = findKeyword( match.groups.body, configuration.endKeyword );
		if ( position !== -1 ) {
			name = match.groups.body.slice(0, position);
			name = name.replace( regExIgnore, "" );

			if ( !stack.length ) {
				// console.log( "empty stack" );
				continue;
			}
			if ( stackNames.indexOf ( name ) === -1 ) {
				// No start for this end - so ignore it
				continue;
			}

			// console.log( "do stack" );
			while ( stack.length ) {
				back = stack.pop();
				stackNames.pop();
				if ( useDates )  {
					back.end = (new Date( match.groups.date )).valueOf() / 1000 - ret.min;
				}
				else {
					back.end = line;
				}

				// if ( false ) {
				if ( back.name !== name && !matchedBegins.has( back.name ) ) {
					// ignore this call
					ignored.add( back.name );
					// console.log( "ignore " + back.name + " because " + name  );
					// console.log( back );
					if ( stack.length ) {
						stack[ stack.length - 1 ].calls = stack[ stack.length - 1 ].calls.concat( back.calls );
					}
					else {
						ret.calls.concat( back.calls );
					}
				}
				else {
					if ( stack.length ) {
						stack[ stack.length - 1 ].calls.push( back );
					}
					else {
						ret.calls.push( back );
					}
				}

				if ( back.name === name ) {
					matchedBegins.add( name );
					break;
				}
			}
		}
	}

	while ( stack.length ) {
		back = stack.pop();
		// stackNames.pop();
		back.end = useDates ? ( ret.max - ret.min ) : line;
		if ( stack.length ) {
			stack[ stack.length - 1 ].calls.push( back );
		}
		else {
			ret.calls.push( back );
		}
	}
	if ( stackNames.length ) {
		vscode.window.showInformationMessage( 'Stack: [ ' + stackNames.join( " || " ) + " ]" );
	}

	// console.log( [...ignored.keys()] )
	// console.log( [...matchedBegins.keys()] )

	ret.max = ret.max - ret.min;
	ret.min = 0;
	// console.log( "done" );
	return ret;
}

function findKeyword( text, keyword ) 
{
	var ret = text.indexOf( keyword );
	if ( ret !== -1 ) {
		// check that we actually found the keyword. If the keyword is "begin", then the word "beginning" shouldn't count.
		if ( ret !== 0 && isAlphaNumeric( text[ ret - 1 ] ) ) {
			return -1;
		}
		var after = ret + keyword.length;
		if ( after < text.length && isAlphaNumeric( text[ after ] ) ) {
			return -1;
		}
	}
	return ret;
}

function isAlphaNumeric( char ) {
	var code;
	code = char.charCodeAt( 0 );
	if (!(code > 47 && code < 58) && // numeric (0-9)
		!(code > 64 && code < 91) && // upper alpha (A-Z)
		!(code > 96 && code < 123)) { // lower alpha (a-z)
		return false;
	}
	return true;
  };

module.exports = {
	activate,
	deactivate
}
