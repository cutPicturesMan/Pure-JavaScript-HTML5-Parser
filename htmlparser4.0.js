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
// 将字符串解析成html格式
// 本质上是解析到单标签时直接处理，解析到双标签时，遇到开始标签对stack数组进行入栈操作，遇到结束标签对stack数组进行出栈操作
(function(){

	// Regular Expressions for parsing tags and attributes
	var startTag = /^<([-A-Za-z0-9_]+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
		endTag = /^<\/([-A-Za-z0-9_]+)[^>]*>/,
		// TODO 没明白属性值的判断(?:\\.|[^"])*)为啥要加上\\.，个人认为不用加
		attr = /([-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;
		
	// Empty Elements - HTML 4.01
  // 空元素：不能存在子节点（内嵌的元素或者元素内的文本）的元素
	var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed");

	// Block Elements - HTML 4.01
	var block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul");

	// Inline Elements - HTML 4.01
	var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

	// Elements that you can, intentionally, leave open
	// (and which close themselves)
  // 自闭标签：可以故意保持元素打开状态，其会自行闭合
	var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");

	// Attributes that have their values filled in disabled="disabled"
  // 属性的value值与key相同
	var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

	// Special Elements (can contain anything)
  // 特殊的元素：可以包含任何东西
	var special = makeMap("script,style");

	var HTMLParser = this.HTMLParser = function( html, handler ) {
    // stack数组专门用来解析双标签（开始标签、结束标签），只要stack数组有值，则表示当前正处于解析双标签的内容中
    var index, chars, match, stack = [], last = html;
		stack.last = function(){
			return this[ this.length - 1 ];
		};

		while ( html ) {
			chars = true;

			// Make sure we're not in a script or style element
      // 排除解析<style>、<script>标签里的内容的情况，下面的条件判断可以看作是!(stack.last() && special[ stack.last() ])
      if ( !stack.last() || !special[ stack.last() ] ) {

			  // 按顺序从左往右解析字符串中的节点，匹配到了则在字符串中移除，并调用对应的处理函数，可能遇到的标签如下：
        // 1、开始标签、结束标签、注释标签：匹配到任意标签，则进行解析，解析完毕之后再次进入while循环
        // 2、文本节点：如果没匹配到情况1的3种标签，则都当作文本节点处理
        // 3、非法标签：不解析，放到最后抛出错误

        // Q：if中为何不直接用正则startTag、endTag进行精确匹配？
        // A：
        // 如果精确匹配，则按顺序进行判断评论标签、结束标签、开始标签，最后为文本标签。每次判断都用正则，文本标签要经过3次正则判断，耗时太久
        // 如果模糊匹配，则
        // 1、由于评论标签、结束标签、开始标签三者的开头部分为互斥关系，因此先用indexOf模糊判断是三者标签的哪一种，速度更快
        // 2、再用正则精确判断该标签是三者中的标签，还是文本标签（文本标签有可能包含这三者的开头），这样文本标签只要1次正则就能判断出来

        // Comment
				if ( html.indexOf("<!--") == 0 ) {
					index = html.indexOf("-->");
	
					if ( index >= 0 ) {
					  // 注释标签是单标签，匹配到之后无需额外处理，直接传给回调函数即可
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
				  // Q：开始标签为何放在注释标签、结束标签之后匹配
				  // A：因为注释标签、结束标签都是"<"开头的，判断不出来到底可能是哪种标签
					match = html.match( startTag );
	
					if ( match ) {
					  // 去掉匹配到的整个开始标签
						html = html.substring( match[0].length );
						match[0].replace( startTag, parseStartTag );
						chars = false;
					}
				}

				if ( chars ) {
					index = html.indexOf("<");

					// 剩余的html字符串是否不存在节点 ? 不存在，说明都是文本节点 : 存在，则截取文本节点
					var text = index < 0 ? html : html.substring( 0, index );
					html = index < 0 ? "" : html.substring( index );

          // 文本节点是单节点，匹配到之后无需额外处理，直接传给回调函数即可
          if ( handler.chars )
						handler.chars( text );
				}

			} else {
        // 将<script>、<style>标签的内容直到结束标签都替换为空字符串，并在最后将其开始标签出栈

        // new RegExp()处理字符串之前会执行常见的转义序列替换，这里的\/并不是转义序列，因此反斜杠会忽略
				html = html.replace(new RegExp("(.*)<\/" + stack.last() + "[^>]*>"), function(all, text){
					text = text.replace(/<!--(.*?)-->/g, "$1")
						.replace(/<!\[CDATA\[(.*?)]]>/g, "$1");

					if ( handler.chars )
						handler.chars( text );

					return "";
				});

				parseEndTag( "", stack.last() );
			}

			// 经过上述流程之后，如果前后字符串没变，则表示解析失败，字符串不是合法的html字符串
			if ( html == last )
				throw "Parse Error: " + html;
			last = html;
		}
		// Clean up any remaining tags
		parseEndTag();

		// 解析开始标签
		function parseStartTag( tag, tagName, rest, unary ) {
			tagName = tagName.toLowerCase();

			// 自动补齐stack中所有内联元素的结束标签
			// 唯一能自动补齐结束标签的情况是：遇到块元素的开始标签时，还有未补全的内联元素
      // 这是因为内联元素不能包裹块元素，所以要将其补齐
			if ( block[ tagName ] ) {
			  // stack数组最后一个元素有值 && 是内联元素
				while ( stack.last() && inline[ stack.last() ] ) {
				  // 自动补全结束标签
					parseEndTag( "", stack.last() );
				}
			}

			// 自动补齐stack中自闭合元素的结束标签
      // 当自闭合标签遇到相邻未闭合的自闭合标签，可以手动将其闭合
      if ( closeSelf[ tagName ] && stack.last() == tagName ) {
				parseEndTag( "", tagName );
			}

			// 一元标签：空元素 || 匹配到"/"结束符
			unary = empty[ tagName ] || !!unary;

			// 非一元标签，需要记录到stack中，以便之后进行标签闭合
			if ( !unary )
				stack.push( tagName );
			
			if ( handler.start ) {
				var attrs = [];

				// 收集开始标签上的属性键值对
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

					attrs.push({
						name: name,
						value: value,
            // 替换未经转义的`"`（以`"`开头的情况也要考虑进去），手动将其转义为`\"`
            // 由于正则优先级的关系，`[^\]`中的斜杠会把`]`转义为字符意义的"]"，导致表达式不正确，因此要先用`\\`把斜杠转义为字符：[^\\]
						escaped: value.replace(/(^|[^\\])"/g, '$1\\\"') //"
					});
				});

				// 将开始标签的相关参数传给start回调函数处理
				if ( handler.start )
					handler.start( tagName, attrs, unary );
			}
		}

    // 解析结束标签（对stack数组进行出栈操作）
    function parseEndTag( tag, tagName ) {
			// If no tag name is provided, clean shop
			if ( !tagName )
				var pos = 0;
				
			// Find the closest opened tag of the same type
      // 在stack数组中，从后往前找到最接近的标签
			else
				for ( var pos = stack.length - 1; pos >= 0; pos-- )
					if ( stack[ pos ] == tagName )
						break;
			
			if ( pos >= 0 ) {
				// Close all the open elements, up the stack
        // 闭合stack数组中找到的标签，以及之后的所有标签（之后的所有标签是该标签的子元素。子元素被父元素包裹，因此该标签闭合了，子元素肯定也要闭合）
				for ( var i = stack.length - 1; i >= pos; i-- )
					if ( handler.end )
						handler.end( stack[ i ] );
				
				// Remove the open elements from the stack
        // 移除掉刚刚处理的标签
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