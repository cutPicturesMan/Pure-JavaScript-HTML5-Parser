/*
 * HTML Parser By John Resig (ejohn.org)
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 * // Use like so:
 * HTMLParser(htmlString, {
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 * // or to get an XML string:
 * HTMLtoXML(htmlString);
 *
 * // or to get an XML DOM Document
 * HTMLtoDOM(htmlString);
 *
 * // or to inject into an existing document/DOM node
 * HTMLtoDOM(htmlString, document);
 * HTMLtoDOM(htmlString, document.body);
 *
 */

(function(){

	// Regular Expressions for parsing tags and attributes
	var startTag = /^<([-A-Za-z0-9_]+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
		endTag = /^<\/([-A-Za-z0-9_]+)[^>]*>/,
    // TODO 没明白属性值的判断(?:\\.|[^"])*)为啥要加上\\.
		attr = /([-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;
		
	// Empty Elements - HTML 4.01
  // 空元素：不能存在子节点（内嵌的元素或者元素内的文本）的元素
	var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed");

	// Block Elements - HTML 4.01
	var block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul");

	// Inline Elements - HTML 4.01
	var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

	// Elements that you can, intentionally, leave open
	// (and which close themselves)
	var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");

	// Attributes that have their values filled in disabled="disabled"
  // 属性的value值与key相同
	var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

	// Special Elements (can contain anything)
	var special = makeMap("script,style");

	var HTMLParser = this.HTMLParser = function( html, handler ) {
		var index, chars, match, stack = [], last = html;
		stack.last = function(){
			return this[ this.length - 1 ];
		};

		while ( html ) {
			chars = true;

			// Make sure we're not in a script or style element
      // 确保stack数组最后一个值为空 || 不为script、style，则进入下述if条件
			if ( !stack.last() || !special[ stack.last() ] ) {

				// Comment
				if ( html.indexOf("<!--") == 0 ) {
					index = html.indexOf("-->");
	
					if ( index >= 0 ) {
						if ( handler.comment )
							handler.comment( html.substring( 4, index ) );
						html = html.substring( index + 3 );
						chars = false;
					}
	
				// end tag
				} else if ( html.indexOf("</") == 0 ) {
					match = html.match( endTag );
	
					if ( match ) {
						html = html.substring( match[0].length );
						match[0].replace( endTag, parseEndTag );
						chars = false;
					}
	
				// start tag
				} else if ( html.indexOf("<") == 0 ) {
					match = html.match( startTag );
	
					if ( match ) {
					  // 去掉匹配到的开始标签
						html = html.substring( match[0].length );
						match[0].replace( startTag, parseStartTag );
						chars = false;
					}
				}

				if ( chars ) {
					index = html.indexOf("<");
					
					var text = index < 0 ? html : html.substring( 0, index );
					html = index < 0 ? "" : html.substring( index );
					
					if ( handler.chars )
						handler.chars( text );
				}

			} else {
				html = html.replace(new RegExp("(.*)<\/" + stack.last() + "[^>]*>"), function(all, text){
					text = text.replace(/<!--(.*?)-->/g, "$1")
						.replace(/<!\[CDATA\[(.*?)]]>/g, "$1");

					if ( handler.chars )
						handler.chars( text );

					return "";
				});

				parseEndTag( "", stack.last() );
			}

			if ( html == last )
				throw "Parse Error: " + html;
			last = html;
		}
		
		// Clean up any remaining tags
		parseEndTag();

		// 解析开始标签
		function parseStartTag( tag, tagName, rest, unary ) {
		  debugger
			tagName = tagName.toLowerCase();

		  // 是块元素
			if ( block[ tagName ] ) {
			  // stack数组最后一个元素有值 && 是内联元素
				while ( stack.last() && inline[ stack.last() ] ) {
				  // TODO
					parseEndTag( "", stack.last() );
				}
			}

      // 是自闭标签 && stack数组最后一个元素与匹配到的标签同名
      if ( closeSelf[ tagName ] && stack.last() == tagName ) {
			  // TODO
				parseEndTag( "", tagName );
			}

			// 一元标签：空元素 || 匹配到"/"结束符
			unary = empty[ tagName ] || !!unary;

			if ( !unary )
				stack.push( tagName );
			
			if ( handler.start ) {
				var attrs = [];
	
				rest.replace(attr, function(match, name) {
				  // 属性的值为
          // 1、双引号中的值
					var value = arguments[2] ? arguments[2] :
            // 2、单引号中的值
						arguments[3] ? arguments[3] :
            // 3、无引号中的值
						arguments[4] ? arguments[4] :
            // 4、没有值，则判断是否是需要将值与key保持相同
						fillAttrs[name] ? name : "";
					debugger
					attrs.push({
						name: name,
						value: value,
            // 替换以`"`开头或不含`\"`的字符
            // TODO 正则优先级：[^\]斜杠会把]转义为字符"]"，导致表达式不正确，因此要先用\把斜杠转义为字符：[^\\]
						escaped: value.replace(/(^|[^\\])"/g, '$1\\\"') //"
					});
				});
	
				if ( handler.start )
					handler.start( tagName, attrs, unary );
			}
		}

		function parseEndTag( tag, tagName ) {
			// If no tag name is provided, clean shop
			if ( !tagName )
				var pos = 0;
				
			// Find the closest opened tag of the same type
			else
				for ( var pos = stack.length - 1; pos >= 0; pos-- )
					if ( stack[ pos ] == tagName )
						break;
			
			if ( pos >= 0 ) {
				// Close all the open elements, up the stack
				for ( var i = stack.length - 1; i >= pos; i-- )
					if ( handler.end )
						handler.end( stack[ i ] );
				
				// Remove the open elements from the stack
				stack.length = pos;
			}
		}
	};
	
	this.HTMLtoXML = function( html ) {
		var results = "";
		
		HTMLParser(html, {
			start: function( tag, attrs, unary ) {
				results += "<" + tag;
		
				for ( var i = 0; i < attrs.length; i++ )
					results += " " + attrs[i].name + '="' + attrs[i].escaped + '"';
		
				results += (unary ? "/" : "") + ">";
			},
			end: function( tag ) {
				results += "</" + tag + ">";
			},
			chars: function( text ) {
				results += text;
			},
			comment: function( text ) {
				results += "<!--" + text + "-->";
			}
		});
		
		return results;
	};
	
	this.HTMLtoDOM = function( html, doc ) {
		// There can be only one of these elements
		var one = makeMap("html,head,body,title");
		
		// Enforce a structure for the document
		var structure = {
			link: "head",
			base: "head"
		};
	
		if ( !doc ) {
			if ( typeof DOMDocument != "undefined" )
				doc = new DOMDocument();
			else if ( typeof document != "undefined" && document.implementation && document.implementation.createDocument )
				doc = document.implementation.createDocument("", "", null);
			else if ( typeof ActiveX != "undefined" )
				doc = new ActiveXObject("Msxml.DOMDocument");
			
		} else
			doc = doc.ownerDocument ||
				doc.getOwnerDocument && doc.getOwnerDocument() ||
				doc;
		
		var elems = [],
			documentElement = doc.documentElement ||
				doc.getDocumentElement && doc.getDocumentElement();
				
		// If we're dealing with an empty document then we
		// need to pre-populate it with the HTML document structure
		if ( !documentElement && doc.createElement ) (function(){
			var html = doc.createElement("html");
			var head = doc.createElement("head");
			head.appendChild( doc.createElement("title") );
			html.appendChild( head );
			html.appendChild( doc.createElement("body") );
			doc.appendChild( html );
		})();
		
		// Find all the unique elements
		if ( doc.getElementsByTagName )
			for ( var i in one )
				one[ i ] = doc.getElementsByTagName( i )[0];
		
		// If we're working with a document, inject contents into
		// the body element
		var curParentNode = one.body;
		
		HTMLParser( html, {
			start: function( tagName, attrs, unary ) {
				// If it's a pre-built element, then we can ignore
				// its construction
				if ( one[ tagName ] ) {
					curParentNode = one[ tagName ];
					if ( !unary ) {
						elems.push( curParentNode );
					}
					return;
				}
			
				var elem = doc.createElement( tagName );
				
				for ( var attr in attrs )
					elem.setAttribute( attrs[ attr ].name, attrs[ attr ].value );
				
				if ( structure[ tagName ] && typeof one[ structure[ tagName ] ] != "boolean" )
					one[ structure[ tagName ] ].appendChild( elem );
				
				else if ( curParentNode && curParentNode.appendChild )
					curParentNode.appendChild( elem );
					
				if ( !unary ) {
					elems.push( elem );
					curParentNode = elem;
				}
			},
			end: function( tag ) {
				elems.length -= 1;
				
				// Init the new parentNode
				curParentNode = elems[ elems.length - 1 ];
			},
			chars: function( text ) {
				curParentNode.appendChild( doc.createTextNode( text ) );
			},
			comment: function( text ) {
				// create comment node
			}
		});
		
		return doc;
	};

	// 'a,b' -> [a, b] -> {a: true, b: true}
	function makeMap(str){
		var obj = {}, items = str.split(",");
		for ( var i = 0; i < items.length; i++ )
			obj[ items[i] ] = true;
		return obj;
	}
})();