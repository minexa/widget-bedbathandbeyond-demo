(function () {

  // Hack to avoid code-snippet change.
  window.__TVPage__ = JSON.stringify(TVPage);
  __TVPage__ = JSON.parse(__TVPage__);
  delete window.TVPage;

  /**
   * almond 0.2.0 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
   * Available via the MIT or new BSD license.
   * see: http://github.com/jrburke/almond for details
   */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
  /*jslint sloppy: true */
  /*global setTimeout: false */

  var requirejs, require, define;
  (function (undef) {
    var main, req, makeMap, handlers,
      defined = {},
      waiting = {},
      config = {},
      defining = {},
      aps = [].slice;

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
      var nameParts, nameSegment, mapValue, foundMap,
        foundI, foundStarMap, starI, i, j, part,
        baseParts = baseName && baseName.split("/"),
        map = config.map,
        starMap = (map && map['*']) || {};

      //Adjust any relative paths.
      if (name && name.charAt(0) === ".") {
        //If have a base name, try to normalize against it,
        //otherwise, assume it is a top-level require that will
        //be relative to baseUrl in the end.
        if (baseName) {
          //Convert baseName to array, and lop off the last part,
          //so that . matches that "directory" and not name of the baseName's
          //module. For instance, baseName of "one/two/three", maps to
          //"one/two/three.js", but we want the directory, "one/two" for
          //this normalization.
          baseParts = baseParts.slice(0, baseParts.length - 1);

          name = baseParts.concat(name.split("/"));

          //start trimDots
          for (i = 0; i < name.length; i += 1) {
            part = name[i];
            if (part === ".") {
              name.splice(i, 1);
              i -= 1;
            } else if (part === "..") {
              if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                //End of the line. Keep at least one non-dot
                //path segment at the front so it can be mapped
                //correctly to disk. Otherwise, there is likely
                //no path mapping for a path starting with '..'.
                //This can still fail, but catches the most reasonable
                //uses of ..
                break;
              } else if (i > 0) {
                name.splice(i - 1, 2);
                i -= 2;
              }
            }
          }
          //end trimDots

          name = name.join("/");
        }
      }

      //Apply map config if available.
      if ((baseParts || starMap) && map) {
        nameParts = name.split('/');

        for (i = nameParts.length; i > 0; i -= 1) {
          nameSegment = nameParts.slice(0, i).join("/");

          if (baseParts) {
            //Find the longest baseName segment match in the config.
            //So, do joins on the biggest to smallest lengths of baseParts.
            for (j = baseParts.length; j > 0; j -= 1) {
              mapValue = map[baseParts.slice(0, j).join('/')];

              //baseName segment has  config, find if it has one for
              //this name.
              if (mapValue) {
                mapValue = mapValue[nameSegment];
                if (mapValue) {
                  //Match, update name to the new value.
                  foundMap = mapValue;
                  foundI = i;
                  break;
                }
              }
            }
          }

          if (foundMap) {
            break;
          }

          //Check for a star map match, but just hold on to it,
          //if there is a shorter segment match later in a matching
          //config, then favor over this star map.
          if (!foundStarMap && starMap && starMap[nameSegment]) {
            foundStarMap = starMap[nameSegment];
            starI = i;
          }
        }

        if (!foundMap && foundStarMap) {
          foundMap = foundStarMap;
          foundI = starI;
        }

        if (foundMap) {
          nameParts.splice(0, foundI, foundMap);
          name = nameParts.join('/');
        }
      }

      return name;
    }

    function makeRequire(relName, forceSync) {
      return function () {
        //A version of a require function that passes a moduleName
        //value for items that may need to
        //look up paths relative to the moduleName
        return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
      };
    }

    function makeNormalize(relName) {
      return function (name) {
        return normalize(name, relName);
      };
    }

    function makeLoad(depName) {
      return function (value) {
        defined[depName] = value;
      };
    }

    function callDep(name) {
      if (waiting.hasOwnProperty(name)) {
        var args = waiting[name];
        delete waiting[name];
        defining[name] = true;
        main.apply(undef, args);
      }

      if (!defined.hasOwnProperty(name) && !defining.hasOwnProperty(name)) {
        throw new Error('No ' + name);
      }
      return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
      var prefix,
        index = name ? name.indexOf('!') : -1;
      if (index > -1) {
        prefix = name.substring(0, index);
        name = name.substring(index + 1, name.length);
      }
      return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
      var plugin,
        parts = splitPrefix(name),
        prefix = parts[0];

      name = parts[1];

      if (prefix) {
        prefix = normalize(prefix, relName);
        plugin = callDep(prefix);
      }

      //Normalize according
      if (prefix) {
        if (plugin && plugin.normalize) {
          name = plugin.normalize(name, makeNormalize(relName));
        } else {
          name = normalize(name, relName);
        }
      } else {
        name = normalize(name, relName);
        parts = splitPrefix(name);
        prefix = parts[0];
        name = parts[1];
        if (prefix) {
          plugin = callDep(prefix);
        }
      }

      //Using ridiculous property names for space reasons
      return {
        f: prefix ? prefix + '!' + name : name, //fullName
        n: name,
        pr: prefix,
        p: plugin
      };
    };

    function makeConfig(name) {
      return function () {
        return (config && config.config && config.config[name]) || {};
      };
    }

    handlers = {
      require: function (name) {
        return makeRequire(name);
      },
      exports: function (name) {
        var e = defined[name];
        if (typeof e !== 'undefined') {
          return e;
        } else {
          return (defined[name] = {});
        }
      },
      module: function (name) {
        return {
          id: name,
          uri: '',
          exports: defined[name],
          config: makeConfig(name)
        };
      }
    };

    main = function (name, deps, callback, relName) {
      var cjsModule, depName, ret, map, i,
        args = [],
        usingExports;

      //Use name if no relName
      relName = relName || name;

      //Call the callback to define the module, if necessary.
      if (typeof callback === 'function') {

        //Pull out the defined dependencies and pass the ordered
        //values to the callback.
        //Default to [require, exports, module] if no deps
        deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
        for (i = 0; i < deps.length; i += 1) {
          map = makeMap(deps[i], relName);
          depName = map.f;

          //Fast path CommonJS standard dependencies.
          if (depName === "require") {
            args[i] = handlers.require(name);
          } else if (depName === "exports") {
            //CommonJS module spec 1.1
            args[i] = handlers.exports(name);
            usingExports = true;
          } else if (depName === "module") {
            //CommonJS module spec 1.1
            cjsModule = args[i] = handlers.module(name);
          } else if (defined.hasOwnProperty(depName) ||
            waiting.hasOwnProperty(depName) ||
            defining.hasOwnProperty(depName)) {
            args[i] = callDep(depName);
          } else if (map.p) {
            map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
            args[i] = defined[depName];
          } else {
            throw new Error(name + ' missing ' + depName);
          }
        }

        ret = callback.apply(defined[name], args);

        if (name) {
          //If setting exports via "module" is in play,
          //favor that over return value and exports. After that,
          //favor a non-undefined return value over exports use.
          if (cjsModule && cjsModule.exports !== undef &&
            cjsModule.exports !== defined[name]) {
            defined[name] = cjsModule.exports;
          } else if (ret !== undef || !usingExports) {
            //Use the return value from the function.
            defined[name] = ret;
          }
        }
      } else if (name) {
        //May just be an object definition for the module. Only
        //worry about defining if have a module name.
        defined[name] = callback;
      }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
      if (typeof deps === "string") {
        if (handlers[deps]) {
          //callback in this case is really relName
          return handlers[deps](callback);
        }
        //Just return the module wanted. In this scenario, the
        //deps arg is the module name, and second arg (if passed)
        //is just the relName.
        //Normalize module name, if it contains . or ..
        return callDep(makeMap(deps, callback).f);
      } else if (!deps.splice) {
        //deps is a config object, not an array.
        config = deps;
        if (callback.splice) {
          //callback is an array, which means it is a dependency list.
          //Adjust args if there are dependencies
          deps = callback;
          callback = relName;
          relName = null;
        } else {
          deps = undef;
        }
      }

      //Support require(['a'])
      callback = callback || function () {};

      //If relName is a function, it is an errback handler,
      //so remove it.
      if (typeof relName === 'function') {
        relName = forceSync;
        forceSync = alt;
      }

      //Simulate async callback;
      if (forceSync) {
        main(undef, deps, callback, relName);
      } else {
        setTimeout(function () {
          main(undef, deps, callback, relName);
        }, 15);
      }

      return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
      config = cfg;
      return req;
    };

    define = function (name, deps, callback) {

      //This module may not have dependencies
      if (!deps.splice) {
        //deps is not an array, so probably means
        //an object literal or factory function for
        //the value. Adjust args.
        callback = deps;
        deps = [];
      }

      waiting[name] = [name, deps, callback];
    };

    define.amd = {
      jQuery: true
    };
  }());
  define("vendor/almond", function(){});      

  define('jquery-private',[],function(){
    return jQuery;
  });
  /**
   * @license RequireJS text 2.0.14 Copyright (c) 2010-2014, The Dojo Foundation All Rights Reserved.
   * Available via the MIT or new BSD license.
   * see: http://github.com/requirejs/text for details
   */
  /*jslint regexp: true */
  /*global require, XMLHttpRequest, ActiveXObject,
   define, window, process, Packages,
   java, location, Components, FileUtils */

  define('text',['module'], function (module) {
    'use strict';

    var text, fs, Cc, Ci, xpcIsWindows,
      progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
      xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
      bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
      hasLocation = typeof location !== 'undefined' && location.href,
      defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
      defaultHostName = hasLocation && location.hostname,
      defaultPort = hasLocation && (location.port || undefined),
      buildMap = {},
      masterConfig = (module.config && module.config()) || {};

    text = {
      version: '2.0.14',

      strip: function (content) {
        //Strips <?xml ...?> declarations so that external SVG and XML
        //documents can be added to a document without worry. Also, if the string
        //is an HTML document, only the part inside the body tag is returned.
        if (content) {
          content = content.replace(xmlRegExp, "");
          var matches = content.match(bodyRegExp);
          if (matches) {
            content = matches[1];
          }
        } else {
          content = "";
        }
        return content;
      },

      jsEscape: function (content) {
        return content.replace(/(['\\])/g, '\\$1')
          .replace(/[\f]/g, "\\f")
          .replace(/[\b]/g, "\\b")
          .replace(/[\n]/g, "\\n")
          .replace(/[\t]/g, "\\t")
          .replace(/[\r]/g, "\\r")
          .replace(/[\u2028]/g, "\\u2028")
          .replace(/[\u2029]/g, "\\u2029");
      },

      createXhr: masterConfig.createXhr || function () {
        //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
        var xhr, i, progId;
        if (typeof XMLHttpRequest !== "undefined") {
          return new XMLHttpRequest();
        } else if (typeof ActiveXObject !== "undefined") {
          for (i = 0; i < 3; i += 1) {
            progId = progIds[i];
            try {
              xhr = new ActiveXObject(progId);
            } catch (e) {}

            if (xhr) {
              progIds = [progId];  // so faster next time
              break;
            }
          }
        }

        return xhr;
      },

      /**
       * Parses a resource name into its component parts. Resource names
       * look like: module/name.ext!strip, where the !strip part is
       * optional.
       * @param {String} name the resource name
       * @returns {Object} with properties "moduleName", "ext" and "strip"
       * where strip is a boolean.
       */
      parseName: function (name) {
        var modName, ext, temp,
          strip = false,
          index = name.lastIndexOf("."),
          isRelative = name.indexOf('./') === 0 ||
            name.indexOf('../') === 0;

        if (index !== -1 && (!isRelative || index > 1)) {
          modName = name.substring(0, index);
          ext = name.substring(index + 1);
        } else {
          modName = name;
        }

        temp = ext || modName;
        index = temp.indexOf("!");
        if (index !== -1) {
          //Pull off the strip arg.
          strip = temp.substring(index + 1) === "strip";
          temp = temp.substring(0, index);
          if (ext) {
            ext = temp;
          } else {
            modName = temp;
          }
        }

        return {
          moduleName: modName,
          ext: ext,
          strip: strip
        };
      },

      xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

      /**
       * Is an URL on another domain. Only works for browser use, returns
       * false in non-browser environments. Only used to know if an
       * optimized .js version of a text resource should be loaded
       * instead.
       * @param {String} url
       * @returns Boolean
       */
      useXhr: function (url, protocol, hostname, port) {
        var uProtocol, uHostName, uPort,
          match = text.xdRegExp.exec(url);
        if (!match) {
          return true;
        }
        uProtocol = match[2];
        uHostName = match[3];

        uHostName = uHostName.split(':');
        uPort = uHostName[1];
        uHostName = uHostName[0];

        return (!uProtocol || uProtocol === protocol) &&
          (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
          ((!uPort && !uHostName) || uPort === port);
      },

      finishLoad: function (name, strip, content, onLoad) {
        content = strip ? text.strip(content) : content;
        if (masterConfig.isBuild) {
          buildMap[name] = content;
        }
        onLoad(content);
      },

      load: function (name, req, onLoad, config) {
        //Name has format: some.module.filext!strip
        //The strip part is optional.
        //if strip is present, then that means only get the string contents
        //inside a body tag in an HTML string. For XML/SVG content it means
        //removing the <?xml ...?> declarations so the content can be inserted
        //into the current doc without problems.

        // Do not bother with the work if a build and text will
        // not be inlined.
        if (config && config.isBuild && !config.inlineText) {
          onLoad();
          return;
        }

        masterConfig.isBuild = config && config.isBuild;

        var parsed = text.parseName(name),
          nonStripName = parsed.moduleName +
            (parsed.ext ? '.' + parsed.ext : ''),
          url = req.toUrl(nonStripName),
          useXhr = (masterConfig.useXhr) ||
            text.useXhr;

        // Do not load if it is an empty: url
        if (url.indexOf('empty:') === 0) {
          onLoad();
          return;
        }

        //Load the text. Use XHR if possible and in a browser.
        if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
          text.get(url, function (content) {
            text.finishLoad(name, parsed.strip, content, onLoad);
          }, function (err) {
            if (onLoad.error) {
              onLoad.error(err);
            }
          });
        } else {
          //Need to fetch the resource across domains. Assume
          //the resource has been optimized into a JS module. Fetch
          //by the module name + extension, but do not include the
          //!strip part to avoid file system issues.
          req([nonStripName], function (content) {
            text.finishLoad(parsed.moduleName + '.' + parsed.ext,
              parsed.strip, content, onLoad);
          });
        }
      },

      write: function (pluginName, moduleName, write, config) {
        if (buildMap.hasOwnProperty(moduleName)) {
          var content = text.jsEscape(buildMap[moduleName]);
          write.asModule(pluginName + "!" + moduleName,
            "define(function () { return '" +
            content +
            "';});\n");
        }
      },

      writeFile: function (pluginName, moduleName, req, write, config) {
        var parsed = text.parseName(moduleName),
          extPart = parsed.ext ? '.' + parsed.ext : '',
          nonStripName = parsed.moduleName + extPart,
          //Use a '.js' file name so that it indicates it is a
          //script that can be loaded across domains.
          fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

        //Leverage own load() method to load plugin value, but only
        //write out values that do not have the strip argument,
        //to avoid any potential issues with ! in file names.
        text.load(nonStripName, req, function (value) {
          //Use own write() method to construct full module value.
          //But need to create shell that translates writeFile's
          //write() to the right interface.
          var textWrite = function (contents) {
            return write(fileName, contents);
          };
          textWrite.asModule = function (moduleName, contents) {
            return write.asModule(moduleName, fileName, contents);
          };

          text.write(pluginName, nonStripName, textWrite, config);
        }, config);
      }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
      typeof process !== "undefined" &&
      process.versions &&
      !!process.versions.node &&
      !process.versions['node-webkit'] &&
      !process.versions['atom-shell'])) {
      //Using special require.nodeRequire, something added by r.js.
      fs = require.nodeRequire('fs');

      text.get = function (url, callback, errback) {
        try {
          var file = fs.readFileSync(url, 'utf8');
          //Remove BOM (Byte Mark Order) from utf8 files if it is there.
          if (file[0] === '\uFEFF') {
            file = file.substring(1);
          }
          callback(file);
        } catch (e) {
          if (errback) {
            errback(e);
          }
        }
      };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
      text.createXhr())) {
      text.get = function (url, callback, errback, headers) {
        var xhr = text.createXhr(), header;
        xhr.open('GET', url, true);

        //Allow plugins direct access to xhr headers
        if (headers) {
          for (header in headers) {
            if (headers.hasOwnProperty(header)) {
              xhr.setRequestHeader(header.toLowerCase(), headers[header]);
            }
          }
        }

        //Allow overrides specified in config
        if (masterConfig.onXhr) {
          masterConfig.onXhr(xhr, url);
        }

        xhr.onreadystatechange = function (evt) {
          var status, err;
          //Do not explicitly handle errors, those should be
          //visible via console output in the browser.
          if (xhr.readyState === 4) {
            status = xhr.status || 0;
            if (status > 399 && status < 600) {
              //An http 4xx or 5xx error. Signal an error.
              err = new Error(url + ' HTTP status: ' + status);
              err.xhr = xhr;
              if (errback) {
                errback(err);
              }
            } else {
              callback(xhr.responseText);
            }

            if (masterConfig.onXhrComplete) {
              masterConfig.onXhrComplete(xhr, url);
            }
          }
        };
        xhr.send(null);
      };
    } else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
      typeof Packages !== 'undefined' && typeof java !== 'undefined')) {
      //Why Java, why is this so awkward?
      text.get = function (url, callback) {
        var stringBuffer, line,
          encoding = "utf-8",
          file = new java.io.File(url),
          lineSeparator = java.lang.System.getProperty("line.separator"),
          input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
          content = '';
        try {
          stringBuffer = new java.lang.StringBuffer();
          line = input.readLine();

          // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
          // http://www.unicode.org/faq/utf_bom.html

          // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
          // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
          if (line && line.length() && line.charAt(0) === 0xfeff) {
            // Eat the BOM, since we've already found the encoding on this file,
            // and we plan to concatenating this buffer with others; the BOM should
            // only appear at the top of a file.
            line = line.substring(1);
          }

          if (line !== null) {
            stringBuffer.append(line);
          }

          while ((line = input.readLine()) !== null) {
            stringBuffer.append(lineSeparator);
            stringBuffer.append(line);
          }
          //Make sure we return a JavaScript string and not a Java string.
          content = String(stringBuffer.toString()); //String
        } finally {
          input.close();
        }
        callback(content);
      };
    } else if (masterConfig.env === 'xpconnect' || (!masterConfig.env &&
      typeof Components !== 'undefined' && Components.classes &&
      Components.interfaces)) {
      //Avert your gaze!
      Cc = Components.classes;
      Ci = Components.interfaces;
      Components.utils['import']('resource://gre/modules/FileUtils.jsm');
      xpcIsWindows = ('@mozilla.org/windows-registry-key;1' in Cc);

      text.get = function (url, callback) {
        var inStream, convertStream, fileObj,
          readData = {};

        if (xpcIsWindows) {
          url = url.replace(/\//g, '\\');
        }

        fileObj = new FileUtils.File(url);

        //XPCOM, you so crazy
        try {
          inStream = Cc['@mozilla.org/network/file-input-stream;1']
            .createInstance(Ci.nsIFileInputStream);
          inStream.init(fileObj, 1, 0, false);

          convertStream = Cc['@mozilla.org/intl/converter-input-stream;1']
            .createInstance(Ci.nsIConverterInputStream);
          convertStream.init(inStream, "utf-8", inStream.available(),
            Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

          convertStream.readString(inStream.available(), readData);
          convertStream.close();
          inStream.close();
          callback(readData.value);
        } catch (e) {
          throw new Error((fileObj && fileObj.path || '') + ': ' + e);
        }
      };
    }
    return text;
  });


  define('text!static/js-css.css',[],function () { return '.tvp-gallery-headline {\n    margin: 15px 0 12px 15px;\n    font-family: FuturaStdHeavy;\n    font-size: 18px !important;\n}\n.tvp-gallery-headline > span {\n    text-transform: uppercase;\n    font-family: FuturaStdHeavy;\n}\n.tvp-skel-row {\n    height: 9px;\n    background-color: #f7f7f7;\n    margin-top: 10px;\n    border: 1px solid #e8e8e8;\n}\n.tvp-skel-row.tvp-mid {\n    width: 40%;\n}\n.tvp-hidden {\n    display: none !important;\n}\n#lb-header-rp {\n    display: none !important;\n    position: absolute;\n    right: 0;\n    top: -16px;\n    font-size: 10px;\n    width: 100%;\n    text-align: center;\n}\n#tvpprd .arrow-indicator {\n    background-color: transparent;\n    width: 36px;\n    height: 58px;\n    position: absolute;\n    top: 20px;\n    right: -36px;\n}\n#tvpprd .arrow-indicator:before {\n    content: " ";\n    width: 0;\n    height: 0;\n    border-top: 15px solid transparent;\n    border-bottom: 15px solid transparent;\n    border-left: 13px solid #e8e8e8;\n    position: absolute;\n    top: 0;\n    left: 1px;\n    margin-left: auto;\n    margin-right: auto;\n}\n#tvpprd .arrow-indicator:after {\n    content: " ";\n    width: 0;\n    height: 0;\n    border-top: 15px solid transparent;\n    border-bottom: 15px solid transparent;\n    border-left: 13px solid #fff;\n    position: absolute;\n    top: 0;\n    left: -1px;\n}\n#tvp-gallery {\n    -webkit-transition: height 600ms cubic-bezier(0.22, 0.3, 0.37, 0.92);\n            transition: height 600ms cubic-bezier(0.22, 0.3, 0.37, 0.92);\n    height: 0px;\n    overflow:hidden;\n    position: relative;\n    opacity: 0.85;\n}\n#tvp-gallery.ready {\n    background-color: #EEEEEE;\n    margin: 8px 0 29px 0;\n}\n#tvp-gallery.tvp-skel {\n    height: auto;\n}\n#tvp-gallery #tvpchg-slider *,\n#tvp-gallery #tvpchg-slider-2 *{\n    outline: none;\n}\n#tvpchg-slider-shield {\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    background-color: transparent;\n    z-index:9999;\n    cursor: wait;\n}\n\n#tvp-gallery #tvpchg-slider.slick-slider,\n#tvp-gallery #tvpchg-slider-2.slick-slider{\n    margin: 0px 0 35px 0;\n}\n#tvp-gallery #tvpchg-slider.slick-slider.ready,\n#tvp-gallery #tvpchg-slider-2.slick-slider.ready{\n    margin: 0px 13px 13px 10px;\n}\n@media screen and (max-width: 767px) {\n    #tvp-gallery #tvpchg-slider.slick-slider .slick-list,\n    #tvp-gallery #tvpchg-slider-2.slick-slider .slick-list{\n        padding-left: 0 !important;\n        margin: 0 0 0 -5px !important;\n    }\n}\n#tvp-gallery #tvpchg-slider.slick-slider .slick-dots,\n#tvp-gallery #tvpchg-slider-2.slick-slider .slick-dots{\n    position: relative;\n    bottom: 0;\n    padding-top: 0;\n    padding-bottom: 0;\n    margin: 0px;\n}\n#tvp-gallery #tvpchg-slider .slick-arrow,\n#tvp-gallery #tvpchg-slider-2 .slick-arrow {\n    z-index: 2;\n    line-height: 0;\n    display: block !important;\n    width: 36px;\n    height: 36px;\n    position: absolute;\n    color: transparent;\n    -webkit-transform: translateY(-50%);\n    transform: translateY(-50%);\n    top: 32%;\n    padding: 0;\n    cursor: pointer;\n    border: none;\n    outline: none;\n}\n#tvp-gallery #tvpchg-slider .slick-prev.slick-disabled,\n#tvp-gallery #tvpchg-slider-2 .slick-prev.slick-disabled {\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAMAAADW3miqAAAAOVBMVEX////////8/Pz6+vr5+fn5+fn4+Pj29vb09PT29vby8vLx8fHw8PDw8PDw8PDw8PDw8PDw8PDv7+/FtFDQAAAAEnRSTlOAhZSbn6Cuvb+/3u3w8/r8/f5HjYQsAAAASUlEQVR4Ae3K2wmAMBAEwDWa8x11+y9W0oB7CIKBm+9BeG1YEpRcuCd9yNVxODrO9JvTOw6sniPj2VxXaXpt0OsyyHUatA7hMzdLOQX/ljGVnwAAAABJRU5ErkJggg==)  0 0 no-repeat;\n    opacity: 1 !important;\n}\n\n#tvp-gallery #tvpchg-slider .slick-prev,\n#tvp-gallery #tvpchg-slider-2 .slick-prev{\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAAAAADEa8dEAAAAfklEQVQ4y+3TMQ6AIAwFUO5/g0qYjIm71xAP0B0TJw7goIBToVAWN5jf0Pz/UU/HUwNx6Ny8iJyB2QsoGIC1jZKBo4k+szdvYk2GeENRxRB0VQxBGI12QuI2KuOEWioqi4BXeZisKmrhVFlwUos0laAmFEdnNXbM9x4/+D/0ApZm572vLMrdAAAAAElFTkSuQmCC) 0 0 no-repeat;\n    left: -10px;\n}\n#tvp-gallery #tvpchg-slider .slick-prev:not(.slick-disabled):hover,\n#tvp-gallery #tvpchg-slider-2 .slick-prev:not(.slick-disabled):hover{\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAMAAADW3miqAAAAPFBMVEX////n5+exsbGdnZ2UlJSSkpJ5eXl4eHhkZGRjY2NiYmJGRkY8PDw7Ozs5OTk1NTU0NDQ1NTUzMzMzMzO2cabbAAAAE3RSTlNNVGlzeXqNjqOlptHl6u74+/z9yW1l7QAAAEpJREFUeAHtytsJgDAQRcFjNMZ31O2/V0kD3kUQFDLfQ/VYNweUmG0L+pgtjmOD40yfOa3jkMrZI/fGsvKv14peZ49cR0JrqF5zAUhHBloYYs0+AAAAAElFTkSuQmCC) 0 100% no-repeat;\n}\n\n#tvp-gallery #tvpchg-slider .slick-next,\n#tvp-gallery #tvpchg-slider-2 .slick-next{\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAAAAADEa8dEAAAAeklEQVQ4y+3TMQ6AIAwFUO5/g0qYjIm710APwI4JEwdw0BAnf3+AxY3OL2n705q7o8xAgPJ2NlGexcUWWkWY+qJDqIKZPFW4HVUqAqZ0TkSRMF+V6ijaokIVRVeMr7YjRiFmEFEDiBtACzWAwsQMzhTs3nG+1/jgn9EDlzrntusNQNoAAAAASUVORK5CYII=) 100% 0 no-repeat;\n    right: -14px;\n}\n#tvp-gallery #tvpchg-slider .slick-next:not(.slick-disabled):hover,\n#tvp-gallery #tvpchg-slider-2 .slick-next:not(.slick-disabled):hover{\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAMAAADW3miqAAAAPFBMVEX////n5+exsbGdnZ2UlJSSkpJ5eXl4eHhkZGRjY2NiYmJGRkY8PDw7Ozs5OTk1NTU0NDQ1NTUzMzMzMzO2cabbAAAAE3RSTlNNVGlzeXqNjqOlptHl6u74+/z9yW1l7QAAAEpJREFUeNrtylEKgCAQBcBnZZZZanv/u8ZewCeBoOB8D6Y/lmvj55FoQQQRvg6pWb7rtaLIJl2ufKIeP9TBzY7aXz2Myyc4g6mtD1PABmF2MmX4AAAAAElFTkSuQmCC) 100% 100% no-repeat;\n}\n#tvp-gallery #tvpchg-slider .slick-next.slick-disabled,\n#tvp-gallery #tvpchg-slider-2 .slick-next.slick-disabled {\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAMAAADW3miqAAAAOVBMVEX////////8/Pz6+vr5+fn5+fn4+Pj29vb09PT29vby8vLx8fHw8PDw8PDw8PDw8PDw8PDw8PDv7+/FtFDQAAAAEnRSTlOAhZSbn6Cuvb+/3u3w8/r8/f5HjYQsAAAASUlEQVR42u3KSQqAMBAEwDaaRbM6/3+szAfSEhAMpM6FZYS5Dn6yFAsiivDl5c0Kv147umzV5fqn6AlTHSR2lLvp0dVOcBuWbz05ewX4xJspIwAAAABJRU5ErkJggg==)  100% 0 no-repeat;\n    opacity: 1 !important;\n}\n\n#tvp-gallery #tvpchg-slider ul,\n#tvp-gallery #tvpchg-slider-2 ul{\n    display: block;\n    position: relative;\n    text-align: center;\n    list-style: none;\n    padding-top: 2px;\n    padding-bottom: 8px;\n}\n#tvp-gallery #tvpchg-slider ul > li,\n#tvp-gallery #tvpchg-slider-2 ul > li{\n    display: inline-block;\n    margin-right: 0;\n    width: 17px;\n    height: 16px;\n}\n#tvp-gallery #tvpchg-slider ul > li button,\n#tvp-gallery #tvpchg-slider-2 ul > li button{\n    width: 13px;\n    height: 14px;\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAsCAYAAAC+GzLvAAAD0UlEQVR42sRVTWhcVRS+f/PmpzPzZiK4ETfWjQqlNNhSiFRcFGGoIW4qLZJg/UMpunDRGKQLfxItimAtIWYj0oUbkRHMgFCMASOKUBCFqrUIIhFqESaZmbz77r1+5743cWomnVEXHjjcd8893/l555x7uXOOdWl2dvYWLM+AR1O+BP4SvDA9Pf1NV493QXNzc8eEEOeklCGY4ZvRmTGGxXEcWWvPYH8aYKNSwIlMJrOYz+cZcRAEjIBQZFEUsU6nE7RarRmtdQj1kzKXy41ks9mPy+VyrlKpsFKpxAqFAoOcQb61kmd43b+8vLyk4OEoFMNqteq90GEvkUellF855+R9SsHSQbLeD9AlkpNHyg+hjglswq77GxF5oVxhvCgQ3hq5HoZIj/QFLDTIyjBEeoioIZBYHXxxGBDqtI68zorJyUms5jgE1wZgDIp8HHTNZz8xMfEdgAfSlulHV3B+eHx8vH5dG3VpaWnpEGKv4ZOqH4E/AaBRq9Wibb33T0iwf0Gqd1N66w8/GiIjRrlgowjiko0c8nQLzZOV7aNRevP3YzIvz8mAh1xyKgr9ZOYMYzayUdwyZyA43Xz2pmQ0Sm/8dkLtkosyaxkXaaHTVOGR8SwLYGNGN2M/Grz46i8jMid/UgUZ8htlCCNxGwPZMgcUxvKo4C7kxqJ8A/4ad1TiKcVjfZDHFMvg/uPWMeHMmAIy9CA3RNNCjcemqFy0ueYixbgaAgRPLjJrikW64Tr2cRYMrrPTjtl23FBM67rZiC8KK/f6+uwEoP/UMetM27O+uKWnV+6UGbGismKkH9AhLBM5E2+aB5tv31P/qyOe/PR2Ifl5GYj9vsBJQySA2F2x2j7anL/3Qt8uLz124RCWGjogxJEfDXCj+c59/8No/Pd5+mjm8s3I5SF83pHyz+BvkcEHR17e/eO2nAC4H8spcLGbZs91qMHvQT7/wCu7rfdUf/7yOJYX/NC53ntuC5jB1yOQFPH9Gv/w1A9lwpGH9EK8vrMZ//sATCooHcZBAmCuT2O7pLtTJPZHAGJ7UumAqdgKfa9CmxQTAGc7vgOJsyR0xwrKWneVlOl5cjsAXdq0NgFdxavhVo2hV9x5Sz6EHqa9pabFHWITnVV6apY31je/73Q0upkOrFciq8Z3uGWxNqy1gVe+rVsQv++LO//w17e1W9FiJpDlwi560ZW//7xyS7M2APRGh9XCc1MLez7b6ojXJz6/FdZewvYuKYW/JK1JwlIZ+Wt1JP/iU+fv/qrvaMzWVvbpyIxBXgQ4zubUF+VKfvWJd/fprs6fAgwAlv8CCnsWGMoAAAAASUVORK5CYII=);\n    background-color: transparent;\n    background-position: 0px 0px;\n    background-repeat: no-repeat;\n    color: transparent;\n}\n#tvp-gallery #tvpchg-slider ul > li button:before,\n#tvp-gallery #tvpchg-slider-2 ul > li button:before {\n    content: "";\n    color: transparent;\n}\n#tvp-gallery #tvpchg-slider ul > li button:hover,\n#tvp-gallery #tvpchg-slider-2 ul > li button:hover {\n    background-position: 0px -15px;\n}\n#tvp-gallery #tvpchg-slider ul > li.slick-active > button,\n#tvp-gallery #tvpchg-slider-2 ul > li.slick-active > button {\n    background-position: 0px -15px;\n    background-color: transparent;\n    color: transparent;\n}\n#tvp-gallery #tvpchg-slider .tvp-video,\n#tvp-gallery #tvpchg-slider-2 .tvp-video{\n    display: block;\n    margin: 0 5px;\n    text-decoration: none;\n    color: #000;\n    cursor: pointer;\n    outline: none;\n}\n@media screen and (max-width: 767px) {\n    #tvp-gallery #tvpchg-slider .tvp-video:first-child,\n    #tvp-gallery #tvpchg-slider-2 .tvp-video:first-child {\n        margin-left: 0px;\n    }\n}\n#tvp-gallery #tvpchg-slider .tvp-video.active .video-overlay,\n#tvp-gallery #tvpchg-slider-2 .tvp-video.active .video-overlay {\n    opacity: 1;\n}\n#tvp-gallery #tvpchg-slider .tvp-video.active .video-playing,\n#tvp-gallery #tvpchg-slider-2 .tvp-video.active .video-playing {\n    opacity: 1;\n}\n#tvp-gallery #tvpchg-slider .tvp-video.active .video-play-button,\n#tvp-gallery #tvpchg-slider-2 .tvp-video.active .video-play-button {\n    display: none;\n}\n#tvp-gallery #tvpchg-slider .tvp-video:not(.active):hover .video-play-button,\n#tvp-gallery #tvpchg-slider .tvp-video:not(.active):hover .play-now,\n#tvp-gallery #tvpchg-slider .tvp-video:not(.active):hover .video-overlay,\n#tvp-gallery #tvpchg-slider-2 .tvp-video:not(.active):hover .video-play-button,\n#tvp-gallery #tvpchg-slider-2 .tvp-video:not(.active):hover .play-now,\n#tvp-gallery #tvpchg-slider-2 .tvp-video:not(.active):hover .video-overlay {\n    opacity: 1;\n}\n#tvp-gallery #tvpchg-slider .tvp-video:focus,\n#tvp-gallery #tvpchg-slider-2 .tvp-video:focus {\n    outline: none;\n}\n#tvp-gallery #tvpchg-slider .tvp-video p,\n#tvp-gallery #tvpchg-slider-2 .tvp-video p {\n    margin: 0;\n}\n#tvp-gallery #tvpchg-slider .tvp-video .tittle,\n#tvp-gallery #tvpchg-slider-2 .tvp-video .tittle {\n    display: block;\n    margin: 8px 0 12px 0;\n    text-align: left;\n    line-height: 18px;\n    font-family: Arial, Helvetica, sans-serif;\n    color: #444;\n    overflow: hidden;\n    text-transform: capitalize;\n    font-size: 13px;\n    height: 38px;\n    overflow: hidden;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image {\n    position: relative;\n    background-repeat: no-repeat;\n    background-position: center;\n    background-size: 102%;\n    position: relative;\n    pointer-events: none;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image:before,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image:before {\n    display: block;\n    content: "";\n    width: 100%;\n    padding-top: 56.25%;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image > .ar-content,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image > .ar-content {\n    position: absolute;\n    top: 0;\n    left: 0;\n    right: 0;\n    bottom: 0;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image .video-overlay,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image .video-overlay {\n    -webkit-transition: all 0.25s ease;\n    transition: all 0.25s ease;\n    pointer-events: none;\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    background-color: rgba(0, 0, 0, 0.2);\n    opacity: 0;\n}\n#tvp-gallery #tvpchg-slider .tvp-skel-overlay {\n    pointer-events: none;\n    background-color: rgb(247, 247, 247);\n    padding-top: 56.25%;\n    border: 1px solid #e8e8e8;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image .video-playing,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image .video-playing {\n    text-align: center;\n    color: #fff;\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    height: 25px;\n    margin: auto;\n    font-weight: bold;\n    line-height: 25px;\n    opacity: 0;\n    font-size: 1.2em;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image .play-now,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image .play-now {\n    text-align: center;\n    color: #fff;\n    position: absolute;\n    bottom: 0;\n    right: 0;\n    height: 25px;\n    margin: auto;\n    font-weight: bold;\n    line-height: 25px;\n    opacity: 0;\n    font-size: 1.2em;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-play-button,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-play-button {\n    position: absolute;\n    top: 50%;\n    left: 50%;\n    -webkit-transform: translate(-50%, -50%);\n    transform: translate(-50%, -50%);\n    width: 37px;\n    height: 37px;\n    border: 1px solid rgb(102, 102, 102);\n    border-radius: 50%;\n    background-color: #eeeeee;\n    -webkit-backface-visibility: hidden;\n            backface-visibility: hidden;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-play-button:after,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-play-button:after {\n    content: \'\';\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    margin: auto;\n    right: 0;\n    left: 3px;\n    width: 0;\n    height: 0;\n    border-top: 9px solid transparent;\n    border-bottom: 9px solid transparent;\n    border-left: 16px solid #273691;\n}\n\n.tvp-progress-bar {\n    background-color: #273691 !important;\n}\n\n#tvplb.off {\n    visibility: hidden;\n    opacity: 0;\n    pointer-events: none;\n}\n#tvplb .lb-overlay {\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    -webkit-transition: opacity .35s ease-in-out;\n            transition: opacity .35s ease-in-out;\n    background-color: rgba(0, 0, 0, 0.45);\n    position: fixed;\n    z-index: 9999;\n    overflow: hidden;\n    -webkit-overflow-scrolling: touch;\n    outline: 0;\n    visibility: visible;\n    opacity: 1;\n    pointer-events: auto;\n    display: none;\n}\n#tvplb .lb-content {\n    -webkit-transition: opacity .25s ease-in-out;\n            transition: opacity .25s ease-in-out;\n    background-color: #FFF;\n    border-radius: 2px;\n    position: fixed;\n    z-index: 999999;\n    width: 50%;\n    margin: 0 auto;\n    left: 0;\n    right: 0;\n    top: 0;\n    border-radius: 1px;\n}\n@media screen and (min-height: 390px) {\n    #tvplb .lb-content {\n        width: 100%;\n    }\n}\n@media screen and (min-width: 768px) {\n    #tvplb .lb-content {\n        background-color: #FFF;\n        -webkit-transform: translateY(-50%);\n        transform: translateY(-50%);\n        width: 90%;\n        margin: 0 auto;\n        left: 0;\n        right: 0;\n        top: 50%;\n    }\n}\n@media screen and (min-width: 960px) {\n    #tvplb .lb-content {\n        max-width: 800px;\n    }\n}\n#tvplb .lb-header {\n    padding: 0 10px;\n    position: relative;\n    background-color: #FFF;\n    height: 40px;\n}\n#tvplb .lb-header:after {\n    content: "";\n    display: table;\n    clear: both;\n}\n#tvplb .lb-header .watch-more-tvp {\n    display: none !important;\n}\n#tvplb .lb-header .watch-more-tvp:after {\n    content: "";\n    display: table;\n    clear: both;\n}\n@media screen and (min-width: 768px) {\n    #tvplb .lb-header .watch-more-tvp {\n        display: block;\n        position: relative;\n        top: 35%;\n        -webkit-transform: translateY(-50%);\n        transform: translateY(-50%);\n        text-decoration: none;\n        float: right;\n        height: 18px;\n        margin-right: 35px;\n    }\n    #tvplb .lb-header .watch-more-tvp span {\n        font-size: 11px;\n        display: inline-block;\n        color: #273691;\n    }\n    #tvplb .lb-header .watch-more-tvp span span {\n        color: #273691;\n        text-decoration: underline;\n    }\n}\n#tvplb .lb-title {\n    color: #444444;\n    padding-left: 18px;\n    margin: 10px 0 30px 0;\n    text-transform: capitalize;\n    font-family: FuturaStdHeavy;\n    font-size: 17px;\n}\n#tvplb .lb-header .lb-close {\n    display: block;\n    float: right;\n    width: 20px;\n    height: 20px;\n    position: relative;\n    cursor: pointer;\n    padding: 0;\n    top: 10px;\n    right: -3px;\n    border: 0;\n    background-color: transparent;\n    opacity: 0.85;\n}\n#tvplb .lb-header .lb-close:hover {\n    opacity: 1;\n}\n#tvplb .lb-header .lb-close:after {\n    width: 18px;\n    height: 18px;\n    background-size: cover;\n    background-repeat: no-repeat;\n    background-position: center;\n    content: \' \';\n    display: block;\n    position: absolute;\n    right: 0;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    margin: auto;\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAAKlBMVEVERET///9ERERERERERERERERERERERERERERERERERERERERERERERETSMAiNAAAADXRSTlMAABFVZneImaq7zN3uzgT4UwAAAIhJREFUeAFlz0FuwCAQQ9FvSCCQ+P7XbYWUOqizfH8zBmh+Ku+pTI8iAd22jzf8uj2LlqcsX4XTTnndHgynxG2aUz4+oafc8cJW4mIrcbGVuNhKXPwr93Jlb75OiKewewq7p7B7ytdnT6lc8ULKw4gDKdSvpzQ44ildrBJHfbkA6rj+HKmNU9IPbVYS6LhZ+T4AAAAASUVORK5CYII=);\n}\n#tvplb .lb-body {\n    padding: 0;\n    margin: 0 17px 0 18px;\n    position: relative;\n}\n#tvplb .lb-body:after {\n    content: "";\n    display: table;\n    clear: both;\n}\n\n.tvp-controls-mp4 .tvp-control-overlay {\n    bottom: 0px;\n    margin: auto;\n    height: 100% !important;\n}\n\n.tvp-hide-mp4 {\n    display: none !important;\n}\n\n#tvpp{\n    background-color: black;\n}\n#tvpp .tvpp-wrapper {\n    position: relative;\n    padding-bottom: 56.25%;\n    left: -1px;\n}\n#tvpp .video-overlay {\n    width: 100%;\n    height: 100%;\n    position: absolute;\n    display: none;\n    background-repeat: no-repeat;\n    background-size: cover;\n}\n#tvpp .tvpp-holder {\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    position: absolute;\n    width: 100%;\n    height: 100%;\n}\n#tvpp.no-products {\n    width: 100%;\n    float: none;\n}\n@media screen and (min-width: 768px) {\n    #tvpp {\n        float: left;\n        width: 83.5%;\n        overflow: hidden;\n    }\n}\n\n#tvpp-play {\n    width: 65px;\n    height: 37px;\n    background-color: #293D9E;\n    opacity: 0.7;\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    bottom: 0;\n    margin: auto;\n    border-radius: 1px;\n    z-index: 9;\n    cursor: pointer;\n}\n#tvpp-play:after {\n    content: " ";\n    width: 0;\n    height: 0;\n    border-top: 7px solid transparent;\n    border-bottom: 7px solid transparent;\n    border-left: 14px solid #fff;\n    position: absolute;\n    left: 0;\n    right: 0;\n    margin: auto;\n    top: 0;\n    bottom: 0;\n}\n#tvpp-play:hover {\n    opacity: 1;\n}\n\n@media screen and (min-width: 768px) {\n    #tvpprd {\n        height: 100%;\n        width: calc(13.85% - 4px);\n        position: absolute;\n        right: 10px;\n        top: 0;\n    }\n    #tvpprd #tvpprd-scroller {\n        height: 100%;\n        overflow: hidden;\n    }\n    #tvpprd #tvpprd-scroller .iScrollVerticalScrollbar {\n        position: absolute;\n        z-index: 9999;\n        width: 6px;\n        bottom: 2px;\n        top: 0;\n        right: -10px;\n    }\n    #tvpprd #tvpprd-scroller .iScrollIndicator {\n        cursor: pointer;\n        background-color: #c7c7c7;\n        box-sizing: border-box;\n        position: absolute;\n        border: 1px solid rgba(255, 255, 255, 0.90196);\n        width: 100%;\n        height: 391px;\n        -webkit-transform: translate(0px, 0px) translateZ(0px);\n                transform: translate(0px, 0px) translateZ(0px);\n        -webkit-transition-timing-function: cubic-bezier(0.1, 0.57, 0.1, 1);\n                transition-timing-function: cubic-bezier(0.1, 0.57, 0.1, 1);\n    }\n    #tvpprd #tvpprd-scroller .product {\n        position: relative;\n        display: block;\n        margin-bottom: 15px;\n    }\n    #tvpprd #tvpprd-scroller .product:before {\n        display: block;\n        content: "";\n        width: 100%;\n        padding-top: 100%;\n    }\n    #tvpprd #tvpprd-scroller .product .ar-content {\n        background-size: contain;\n        background-repeat: no-repeat;\n        background-position: center;\n        position: absolute;\n        top: 0;\n        left: 0;\n        right: 0;\n        bottom: 0;\n        color: #e8e8e8;\n        border: 1px solid #e8e8e8;\n    }\n    #tvpprd #tvpprd-scroller .product .product-overlay {\n        opacity: 0;\n        width: 100%;\n        height: 100%;\n        position: absolute;\n        top: 0;\n        left: 0;\n        background: rgba(0, 0, 0, 0.7);\n        z-index: 2;\n        -webkit-transition: opacity .25s ease-in-out;\n                transition: opacity .25s ease-in-out;\n    }\n    #tvpprd #tvpprd-scroller .product .product-overlay span {\n        display: block;\n        color: #FFF;\n        border-bottom: 1px solid #D32F36;\n        position: absolute;\n        top: 50%;\n        left: 50%;\n        -webkit-transform: translate(-50%, -50%);\n        transform: translate(-50%, -50%);\n        text-align: center;\n    }\n    #tvpprd #tvpprd-scroller .product:hover .product-overlay {\n        opacity: 1;\n    }\n}\n#tvpprd #tvpprd-slider {\n    min-height: 75px;\n    display: none;\n    background-color: #FFF;\n}\n#tvpprd #tvpprd-slider.slick-slider {\n    margin: 0px;\n}\n#tvpprd #tvpprd-slider.slick-slider .slick-dots {\n    position: relative;\n    bottom: 0;\n    padding-top: 0;\n    padding-bottom: 0;\n    margin: 0px;\n}\n#tvpprd #tvpprd-slider.slick-initialized {\n    display: block;\n}\n#tvpprd #tvpprd-slider .prd-item-graphic {\n    border: 1px solid #EAEAEA;\n}\n#tvpprd #tvpprd-slider .prd-item-call-t-action {\n    position: absolute;\n    bottom: 0;\n    right: 0;\n    color: #A4A4A4;\n    font-size: 9px;\n}\n#tvpprd #tvpprd-slider .prd-item-call-t-action .arrow-right {\n    content: "";\n    display: inline-block;\n    width: 6px;\n    height: 6px;\n    border-right: 2px solid #A4A4A4;\n    border-top: 2px solid #A4A4A4;\n    -webkit-transform: rotate(45deg);\n            transform: rotate(45deg);\n    margin-right: 5px;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating {\n    height: 13px;\n    font-size: 12px;\n    list-style: none;\n    margin: 0 0 0 15px;\n    padding: 0;\n    text-align: center;\n    float: left;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating li {\n    display: inline-block;\n    height: 20px;\n    height: 20px;\n    line-height: 20px;\n    margin: 0;\n    padding-right: 5px;\n    vertical-align: top;\n    color: #000;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating .star {\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAOCAMAAACb3vX5AAAAq1BMVEUAAAD/pyP/qif/qiv/qyb/qyf/qyj/rCfV1dX/qivV1dX/qivKysr/pyPNzc3/rSnOzs7/qybNzc3/qifNzc3/rCjNzc3/rCfMzMz/rCfMzMz/qyjMzMz/qyfMzMz/rCfMzMz/qybMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyf///8cpB0hAAAANnRSTlMAAAAAAAAAAAYGDAwdHTg4Q0NISE1NXFxubnNzd3fW1tvb4+Pn5+vr7u709PX19vb4+P39/v7CVzJLAAAA0klEQVR4AZXK11KEQBSE4VY8soJBV2XBLKsz5rCh5/3fTLqOI+Wd9k3XV/XjX5vNfqkpRzQNyh/O5/C5ehvR97DM05SO9VmcbmackFMzEXUXU4pdDWQxtFUhVG2gYCVwnb53C8DFYTdbwBU1wYCDpWfrI0DybnU4dPsLRYIB6Ly7hCapuzChVSVIuFf2CJ9EPpjjjhS8e1X3CZ9EfpjjhRS8W6YY0xo+KXBljgWDYGL9fg50z3vQpG20T7sbQvV2VtiAUt2OB/kKaBMdJkDh99d9AVonIyLyaQ9MAAAAAElFTkSuQmCC);\n    background-repeat: no-repeat;\n    width: 11px;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating .star-empty {\n    background-position: -28px 0;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating .star-full {\n    background-position: 0 0;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating .star-half {\n    background-position: -15px 0;\n}\n#tvpprd .product-popup {\n    display: none;\n    position: absolute;\n    width: 245px;\n    padding: 8px;\n    z-index: 9999;\n    background-color: white;\n    box-shadow: 0 8px 30px -5px rgba(0, 0, 0, 0.35);\n    text-decoration: none;\n    border: 1px solid #e8e8e8;\n}\n#tvpprd .product-popup .pop-up-before {\n    display: none;\n    content: " ";\n    width: 0;\n    height: 0;\n    border-style: solid;\n    border-width: 13px 0 13px 13px;\n    border-color: transparent transparent transparent #FFF;\n    position: absolute;\n    top: 25px;\n    right: -12px;\n    margin-top: -5px;\n    z-index: 99999;\n}\n#tvpprd .product-popup .product-title{\n    text-align: center;\n    margin-top: 10px;\n    margin-bottom: 10px;\n    line-height: 0.85;\n    font-family: Arial,sans-serif;\n    font-size: 21px;\n    font-weight: 400;\n}\n#tvpprd .product-popup .product-title > a {\n    font-family: Arial,sans-serif;\n    text-align: center;\n    font-size: 14px;\n    color: #444444 !important;\n}\n#tvpprd .product-popup .product-price {\n    text-align: center;\n    font-size: 20px;\n    color: #273691;\n    font-family: Arial,sans-serif;\n    font-weight: bold;\n    margin: 15px 0 11px 0;\n}\n#tvpprd .product-popup .call-to-action {\n    display: block;\n    font-size: 17px;\n    padding: 0;\n    height: 40px;\n    text-align: center;\n    color: #273691;\n    font-family: FuturaStdMedium;\n    width: 100%;\n    border: none;\n    text-transform: uppercase;\n    background-color: #efefef;\n    border-bottom: 2px solid #dddddd;\n}\n#tvpprd .product-popup .call-to-action:hover {\n    background-color: #e0e0e0;\n}\n#tvpprd .product-popup .product-img {\n    position: relative;\n}\n#tvpprd .product-popup .product-img:before {\n    display: block;\n    content: "";\n    width: 100%;\n    padding-top: 95%;\n}\n#tvpprd .product-popup .product-img .ar-content {\n    background-size: cover;\n    background-repeat: no-repeat;\n    background-position: center;\n    position: absolute;\n    top: 0;\n    left: 0;\n    right: 0;\n    bottom: 0;\n}\n#tvpprd .product-popup .tvp-product-rating {\n    height: 24px;\n    font-size: 12px;\n    list-style: none;\n    margin: 0 0 10px;\n    padding: 0;\n    text-align: center;\n}\n#tvpprd .product-popup .tvp-product-rating li {\n    display: inline-block;\n    height: 20px;\n    line-height: 24px;\n    margin: 0;\n    vertical-align: top;\n    color: #444;\n}\n#tvpprd .product-popup .tvp-product-rating li:last-child {\n    margin-left: 10px;\n}\n#tvpprd .product-popup .tvp-product-rating .star {\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAABQCAMAAAAunqVFAAABv1BMVEUAAAD/6gD/////6gD/6gAAAAD/6gD/6gAAAAAAAAD/6gAAAAD/6gAAAAD/6gD/6gD/6gAAAAD/6gD/6gD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gD/6gD/6gD/6gD/6gD/6gD/6gAAAAD/6gD/6gAAAAD/6gAAAAAAAAD/6gAAAAAAAAD/6gAAAAD/6gAAAAD/6gD/6gD/6gAAAAD/6gD/6gD/6gD/6gAAAAD/6gD/6gAAAAAAAAD/6gD/6gD/6gAAAAAAAAD/6gD/6gD/6gAAAAD/6gAAAAD/6gAAAAAAAAAAAAD/6gAAAAD/6gD/6gD/6gAAAAAAAAAAAAD/6gD/6gD/6gAAAAD/6gD/6gD/6gD/6gD/6gD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gAAAAD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gD/6gAAAAAAAAAAAAAAAAAAAAAAAAD/6gAAAAD/6gD/6gD/6gD/6gD/6gAAAAAAAAD/6gD/6gAAAAAAAAAAAAD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gAAAAD/6gAAAAAAAAD/6gAU0e3RAAAAk3RSTlMAAAABAgMDBAUHCAkJCgoREhYXGBkcHiUoKisrLC0uMzc7PDw9PkFDRERFRkZITU5SU1VWVldYWltgYWRlZ2hqbW5uc3R1d3h4f4SHiIuLjY+Qk5WZmpudnZ6foKOkpaWor7S2trm+w8XGx8nR0dLT1d7e3+Hi4+Tm5+jp6uvs7e7v8PDx8/T19vf4+vr7/Pz9/f67BYZ4AAAB60lEQVR42sXR11cTQRTH8RnABFCKgaAYWkCQomLBKCq9FwXpKIaioqKIRkUpCaCUEGq49w82lzCzZfYB5HD4Peyc/bzMnv0yLlZUxGkxkWk4Pq5ixt5ehoKdiJ1mTPQj+hNNWImRVWpoc2SVeGYIZzwlWQ5bBLv9aJq/m9n6zNhnY5w3G605elFFSKNQhbjdHRAWcGufNCFwgkuMXRa4HCvRhXIuiVX0OjxMzyqJI4jT7sh904gjEn2r9XY67fWrPoHpo2lENMdoOmGMOmv8r3Dh44bz+QJquMYGfGwOF0xNDX59eDMnza4LN8T5gCHcy+q77hTOU67fq3mF2B8Nt5jHj5Y7j60iXPBO1G4HQw+0cGEXnVfDSwW6cDvJdFzafqsP94lzj4fzqb9xunBdmZOIk5nPMVsXbmqHwm1/wGqrcK+twn23Dnc+jdCqEVo0QlQa0QyNBBobCTQ1EmhsRKg0IlQaESqNaEojxDNtdGJktFvv1mG2x8mYDl8A/Pq8ASuFOqyFHzcYS2rbX3FKvPhn8wqjtUGvxFIYZIdL2piV+ATqWHRfQOJ9aD/CuTWJzoNvCYdWBm8ksvcwRnrtNxRLbAGAn8+avFvQwQSSfdwFgIWnTCBZC7tc/ig/nkn0kokJvOAlEzv9T/4H4BEA82AwTEoAAAAASUVORK5CYII=);\n    background-repeat: no-repeat;\n    width: 19px;\n}\n#tvpprd .product-popup .tvp-product-rating .star-empty {\n    background-position: 0 -20px;\n}\n#tvpprd .product-popup .tvp-product-rating .star-full {\n    background-position: 0 0;\n}\n#tvpprd .product-popup .tvp-product-rating .star-half {\n    background-position: 0 -41px;\n}\n#tvpprd .prd-item {\n    display: block;\n    background-color: white;\n    height: 75px;\n    margin: 8px 4px;\n    border-radius: 1px;\n    border: 1px solid #DDD;\n    position: relative;\n}\n#tvpprd .prd-item:after {\n    content: "";\n    display: table;\n    clear: both;\n}\n#tvpprd .prd-item.hovered {\n    background-color: #EEE;\n}\n#tvpprd .prd-item-graphic {\n    float: left;\n    width: 60px;\n    position: relative;\n    top: 50%;\n    -webkit-transform: translateY(-50%);\n    transform: translateY(-50%);\n    left: 5px;\n}\n#tvpprd .prd-item-graphic > div {\n    background-size: cover;\n    background-repeat: no-repeat;\n    background-position: center center;\n    padding-top: 100%;\n}\n#tvpprd .prd-item-text {\n    float: right;\n    width: calc(100% - 80px);\n    position: relative;\n    top: 50%;\n    -webkit-transform: translateY(-50%);\n    transform: translateY(-50%);\n    right: 5px;\n}\n#tvpprd .bottom-description {\n    font-size: 10px;\n    letter-spacing: 1px;\n    margin-top: 5px;\n}\n#tvpprd .prd-item-title {\n    margin: 10px 0 0 0;\n    font-size: 12px;\n    min-height: 36px;\n    max-height: 36px;\n    overflow: hidden;\n    color: #323232;\n    font-weight: normal;\n    font-family: FuturaStdLight,sans-serif;\n}\n@media screen and (max-width: 767px) {\n    #tvpprd .prd-item-title {\n        margin: 0;\n        white-space: nowrap;\n        text-overflow: ellipsis;\n        min-height: initial;\n    }\n}\n@media screen and (max-height: 389px) {\n    #tvpprd .prd-item-title {\n        margin: 0;\n        white-space: nowrap;\n        text-overflow: ellipsis;\n        min-height: initial;\n    }\n}\n#tvpprd .prd-item-price {\n    margin: 0;\n    color: #000;\n    font-size: 16px;\n    float: left;\n    font-weight: bold;\n}\n\n.slick-dots {\n    display: block;\n    position: relative;\n    text-align: center;\n    list-style: none;\n    padding-top: 2px;\n    padding-bottom: 8px;\n}\n.slick-dots > li {\n    display: inline-block;\n    margin-right: 4px;\n}\n.slick-dots > li button {\n    width: 13px;\n    height: 14px;\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAsCAYAAAC+GzLvAAAD0UlEQVR42sRVTWhcVRS+f/PmpzPzZiK4ETfWjQqlNNhSiFRcFGGoIW4qLZJg/UMpunDRGKQLfxItimAtIWYj0oUbkRHMgFCMASOKUBCFqrUIIhFqESaZmbz77r1+5743cWomnVEXHjjcd8893/l555x7uXOOdWl2dvYWLM+AR1O+BP4SvDA9Pf1NV493QXNzc8eEEOeklCGY4ZvRmTGGxXEcWWvPYH8aYKNSwIlMJrOYz+cZcRAEjIBQZFEUsU6nE7RarRmtdQj1kzKXy41ks9mPy+VyrlKpsFKpxAqFAoOcQb61kmd43b+8vLyk4OEoFMNqteq90GEvkUellF855+R9SsHSQbLeD9AlkpNHyg+hjglswq77GxF5oVxhvCgQ3hq5HoZIj/QFLDTIyjBEeoioIZBYHXxxGBDqtI68zorJyUms5jgE1wZgDIp8HHTNZz8xMfEdgAfSlulHV3B+eHx8vH5dG3VpaWnpEGKv4ZOqH4E/AaBRq9Wibb33T0iwf0Gqd1N66w8/GiIjRrlgowjiko0c8nQLzZOV7aNRevP3YzIvz8mAh1xyKgr9ZOYMYzayUdwyZyA43Xz2pmQ0Sm/8dkLtkosyaxkXaaHTVOGR8SwLYGNGN2M/Grz46i8jMid/UgUZ8htlCCNxGwPZMgcUxvKo4C7kxqJ8A/4ad1TiKcVjfZDHFMvg/uPWMeHMmAIy9CA3RNNCjcemqFy0ueYixbgaAgRPLjJrikW64Tr2cRYMrrPTjtl23FBM67rZiC8KK/f6+uwEoP/UMetM27O+uKWnV+6UGbGismKkH9AhLBM5E2+aB5tv31P/qyOe/PR2Ifl5GYj9vsBJQySA2F2x2j7anL/3Qt8uLz124RCWGjogxJEfDXCj+c59/8No/Pd5+mjm8s3I5SF83pHyz+BvkcEHR17e/eO2nAC4H8spcLGbZs91qMHvQT7/wCu7rfdUf/7yOJYX/NC53ntuC5jB1yOQFPH9Gv/w1A9lwpGH9EK8vrMZ//sATCooHcZBAmCuT2O7pLtTJPZHAGJ7UumAqdgKfa9CmxQTAGc7vgOJsyR0xwrKWneVlOl5cjsAXdq0NgFdxavhVo2hV9x5Sz6EHqa9pabFHWITnVV6apY31je/73Q0upkOrFciq8Z3uGWxNqy1gVe+rVsQv++LO//w17e1W9FiJpDlwi560ZW//7xyS7M2APRGh9XCc1MLez7b6ojXJz6/FdZewvYuKYW/JK1JwlIZ+Wt1JP/iU+fv/qrvaMzWVvbpyIxBXgQ4zubUF+VKfvWJd/fprs6fAgwAlv8CCnsWGMoAAAAASUVORK5CYII=);\n    background-color: transparent;\n    background-position: 0px 0px;\n    background-repeat: no-repeat;\n    color: transparent;\n}\n.slick-dots > li button:before {\n    content: "";\n    color: transparent;\n}\n.slick-dots > li button:hover {\n    background-position: 0px -15px;\n}\n.slick-dots > li.slick-active > button {\n    background-position: 0px -15px;\n    background-color: transparent;\n    color: transparent;\n}';});
  define('src/js/jquery.pubsub-loader',['jquery-private'],function($){

    /* jQuery Tiny Pub/Sub - v0.7 - 10/27/2011
     * http://benalman.com/
     * Copyright (c) 2011 "Cowboy" Ben Alman; Licensed MIT, GPL */
    (function(a){var b=a({});a.subscribe=function(){b.on.apply(b,arguments)},a.unsubscribe=function(){b.off.apply(b,arguments)},a.publish=function(){b.trigger.apply(b,arguments)}})($);

  });
  define('src/js/config',['require'],function(require) {

    // Add globals with data from the backend.
    window._tvp = window._tvp || {};
    _tvp.assetsBaseUrl = true ? "//do0631budpzeh.cloudfront.net/live/tvsite/1758166/www.bedbathandbeyond.tv/2c89f5355fcf650a2241f7a2dd826681".replace('//', '').split('/').shift() : 'app.tvpage.com/tvsite/' + domain;
    _tvp.lid = '1758166';

    //Aquire ID from URL
    var settings = JSON.parse("\x7B\x2210517\x22\x3A\x2281791048\x22,\x2212962\x22\x3A\x2281791045\x22,\x2213138\x22\x3A\x2281791055\x22,\x2214307\x22\x3A\x2277559778\x22,\x22analytics\x2Dcartridge\x2Did\x22\x3A\x221190\x22,\x22placeholder\x2Did\x22\x3A\x22tvp\x2Dgallery\x22,\x22videos\x2Dslider\x2D1\x22\x3A\x221189\x22,\x22default\x2Dchannel\x22\x3A\x2266716699\x22,\x22demo\x2Dcat\x22\x3A\x2266716699\x22,\x22related\x2Dproducts\x2Ddesktop\x22\x3A\x221638\x22\x7D");

    _tvp.channelId = 81791055;
    _tvp.chgEndpoint = "//app.tvpage.com/tvsite/embed.bedbathandbeyond.com/cartridge/" + settings["videos-slider-1"];
    _tvp.analyticsEndpoint = "//app.tvpage.com/tvsite/embed.bedbathandbeyond.com/cartridge/" + settings["analytics-1"];
    _tvp.relatedProductsDesktop = "//app.tvpage.com/tvsite/embed.bedbathandbeyond.com/cartridge/" + settings["related-products-desktop"];
  });

//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.
  (function(){function n(n){function t(t,r,e,u,i,o){for(;i>=0&&o>i;i+=n){var a=u?u[i]:i;e=r(e,t[a],a,t)}return e}return function(r,e,u,i){e=b(e,i,4);var o=!k(r)&&m.keys(r),a=(o||r).length,c=n>0?0:a-1;return arguments.length<3&&(u=r[o?o[c]:c],c+=n),t(r,e,u,o,c,a)}}function t(n){return function(t,r,e){r=x(r,e);for(var u=O(t),i=n>0?0:u-1;i>=0&&u>i;i+=n)if(r(t[i],i,t))return i;return-1}}function r(n,t,r){return function(e,u,i){var o=0,a=O(e);if("number"==typeof i)n>0?o=i>=0?i:Math.max(i+a,o):a=i>=0?Math.min(i+1,a):i+a+1;else if(r&&i&&a)return i=r(e,u),e[i]===u?i:-1;if(u!==u)return i=t(l.call(e,o,a),m.isNaN),i>=0?i+o:-1;for(i=n>0?o:a-1;i>=0&&a>i;i+=n)if(e[i]===u)return i;return-1}}function e(n,t){var r=I.length,e=n.constructor,u=m.isFunction(e)&&e.prototype||a,i="constructor";for(m.has(n,i)&&!m.contains(t,i)&&t.push(i);r--;)i=I[r],i in n&&n[i]!==u[i]&&!m.contains(t,i)&&t.push(i)}var u=this,i=u._,o=Array.prototype,a=Object.prototype,c=Function.prototype,f=o.push,l=o.slice,s=a.toString,p=a.hasOwnProperty,h=Array.isArray,v=Object.keys,g=c.bind,y=Object.create,d=function(){},m=function(n){return n instanceof m?n:this instanceof m?void(this._wrapped=n):new m(n)};"undefined"!=typeof exports?("undefined"!=typeof module&&module.exports&&(exports=module.exports=m),exports._=m):u._=m,m.VERSION="1.8.3";var b=function(n,t,r){if(t===void 0)return n;switch(null==r?3:r){case 1:return function(r){return n.call(t,r)};case 2:return function(r,e){return n.call(t,r,e)};case 3:return function(r,e,u){return n.call(t,r,e,u)};case 4:return function(r,e,u,i){return n.call(t,r,e,u,i)}}return function(){return n.apply(t,arguments)}},x=function(n,t,r){return null==n?m.identity:m.isFunction(n)?b(n,t,r):m.isObject(n)?m.matcher(n):m.property(n)};m.iteratee=function(n,t){return x(n,t,1/0)};var _=function(n,t){return function(r){var e=arguments.length;if(2>e||null==r)return r;for(var u=1;e>u;u++)for(var i=arguments[u],o=n(i),a=o.length,c=0;a>c;c++){var f=o[c];t&&r[f]!==void 0||(r[f]=i[f])}return r}},j=function(n){if(!m.isObject(n))return{};if(y)return y(n);d.prototype=n;var t=new d;return d.prototype=null,t},w=function(n){return function(t){return null==t?void 0:t[n]}},A=Math.pow(2,53)-1,O=w("length"),k=function(n){var t=O(n);return"number"==typeof t&&t>=0&&A>=t};m.each=m.forEach=function(n,t,r){t=b(t,r);var e,u;if(k(n))for(e=0,u=n.length;u>e;e++)t(n[e],e,n);else{var i=m.keys(n);for(e=0,u=i.length;u>e;e++)t(n[i[e]],i[e],n)}return n},m.map=m.collect=function(n,t,r){t=x(t,r);for(var e=!k(n)&&m.keys(n),u=(e||n).length,i=Array(u),o=0;u>o;o++){var a=e?e[o]:o;i[o]=t(n[a],a,n)}return i},m.reduce=m.foldl=m.inject=n(1),m.reduceRight=m.foldr=n(-1),m.find=m.detect=function(n,t,r){var e;return e=k(n)?m.findIndex(n,t,r):m.findKey(n,t,r),e!==void 0&&e!==-1?n[e]:void 0},m.filter=m.select=function(n,t,r){var e=[];return t=x(t,r),m.each(n,function(n,r,u){t(n,r,u)&&e.push(n)}),e},m.reject=function(n,t,r){return m.filter(n,m.negate(x(t)),r)},m.every=m.all=function(n,t,r){t=x(t,r);for(var e=!k(n)&&m.keys(n),u=(e||n).length,i=0;u>i;i++){var o=e?e[i]:i;if(!t(n[o],o,n))return!1}return!0},m.some=m.any=function(n,t,r){t=x(t,r);for(var e=!k(n)&&m.keys(n),u=(e||n).length,i=0;u>i;i++){var o=e?e[i]:i;if(t(n[o],o,n))return!0}return!1},m.contains=m.includes=m.include=function(n,t,r,e){return k(n)||(n=m.values(n)),("number"!=typeof r||e)&&(r=0),m.indexOf(n,t,r)>=0},m.invoke=function(n,t){var r=l.call(arguments,2),e=m.isFunction(t);return m.map(n,function(n){var u=e?t:n[t];return null==u?u:u.apply(n,r)})},m.pluck=function(n,t){return m.map(n,m.property(t))},m.where=function(n,t){return m.filter(n,m.matcher(t))},m.findWhere=function(n,t){return m.find(n,m.matcher(t))},m.max=function(n,t,r){var e,u,i=-1/0,o=-1/0;if(null==t&&null!=n){n=k(n)?n:m.values(n);for(var a=0,c=n.length;c>a;a++)e=n[a],e>i&&(i=e)}else t=x(t,r),m.each(n,function(n,r,e){u=t(n,r,e),(u>o||u===-1/0&&i===-1/0)&&(i=n,o=u)});return i},m.min=function(n,t,r){var e,u,i=1/0,o=1/0;if(null==t&&null!=n){n=k(n)?n:m.values(n);for(var a=0,c=n.length;c>a;a++)e=n[a],i>e&&(i=e)}else t=x(t,r),m.each(n,function(n,r,e){u=t(n,r,e),(o>u||1/0===u&&1/0===i)&&(i=n,o=u)});return i},m.shuffle=function(n){for(var t,r=k(n)?n:m.values(n),e=r.length,u=Array(e),i=0;e>i;i++)t=m.random(0,i),t!==i&&(u[i]=u[t]),u[t]=r[i];return u},m.sample=function(n,t,r){return null==t||r?(k(n)||(n=m.values(n)),n[m.random(n.length-1)]):m.shuffle(n).slice(0,Math.max(0,t))},m.sortBy=function(n,t,r){return t=x(t,r),m.pluck(m.map(n,function(n,r,e){return{value:n,index:r,criteria:t(n,r,e)}}).sort(function(n,t){var r=n.criteria,e=t.criteria;if(r!==e){if(r>e||r===void 0)return 1;if(e>r||e===void 0)return-1}return n.index-t.index}),"value")};var F=function(n){return function(t,r,e){var u={};return r=x(r,e),m.each(t,function(e,i){var o=r(e,i,t);n(u,e,o)}),u}};m.groupBy=F(function(n,t,r){m.has(n,r)?n[r].push(t):n[r]=[t]}),m.indexBy=F(function(n,t,r){n[r]=t}),m.countBy=F(function(n,t,r){m.has(n,r)?n[r]++:n[r]=1}),m.toArray=function(n){return n?m.isArray(n)?l.call(n):k(n)?m.map(n,m.identity):m.values(n):[]},m.size=function(n){return null==n?0:k(n)?n.length:m.keys(n).length},m.partition=function(n,t,r){t=x(t,r);var e=[],u=[];return m.each(n,function(n,r,i){(t(n,r,i)?e:u).push(n)}),[e,u]},m.first=m.head=m.take=function(n,t,r){return null==n?void 0:null==t||r?n[0]:m.initial(n,n.length-t)},m.initial=function(n,t,r){return l.call(n,0,Math.max(0,n.length-(null==t||r?1:t)))},m.last=function(n,t,r){return null==n?void 0:null==t||r?n[n.length-1]:m.rest(n,Math.max(0,n.length-t))},m.rest=m.tail=m.drop=function(n,t,r){return l.call(n,null==t||r?1:t)},m.compact=function(n){return m.filter(n,m.identity)};var S=function(n,t,r,e){for(var u=[],i=0,o=e||0,a=O(n);a>o;o++){var c=n[o];if(k(c)&&(m.isArray(c)||m.isArguments(c))){t||(c=S(c,t,r));var f=0,l=c.length;for(u.length+=l;l>f;)u[i++]=c[f++]}else r||(u[i++]=c)}return u};m.flatten=function(n,t){return S(n,t,!1)},m.without=function(n){return m.difference(n,l.call(arguments,1))},m.uniq=m.unique=function(n,t,r,e){m.isBoolean(t)||(e=r,r=t,t=!1),null!=r&&(r=x(r,e));for(var u=[],i=[],o=0,a=O(n);a>o;o++){var c=n[o],f=r?r(c,o,n):c;t?(o&&i===f||u.push(c),i=f):r?m.contains(i,f)||(i.push(f),u.push(c)):m.contains(u,c)||u.push(c)}return u},m.union=function(){return m.uniq(S(arguments,!0,!0))},m.intersection=function(n){for(var t=[],r=arguments.length,e=0,u=O(n);u>e;e++){var i=n[e];if(!m.contains(t,i)){for(var o=1;r>o&&m.contains(arguments[o],i);o++);o===r&&t.push(i)}}return t},m.difference=function(n){var t=S(arguments,!0,!0,1);return m.filter(n,function(n){return!m.contains(t,n)})},m.zip=function(){return m.unzip(arguments)},m.unzip=function(n){for(var t=n&&m.max(n,O).length||0,r=Array(t),e=0;t>e;e++)r[e]=m.pluck(n,e);return r},m.object=function(n,t){for(var r={},e=0,u=O(n);u>e;e++)t?r[n[e]]=t[e]:r[n[e][0]]=n[e][1];return r},m.findIndex=t(1),m.findLastIndex=t(-1),m.sortedIndex=function(n,t,r,e){r=x(r,e,1);for(var u=r(t),i=0,o=O(n);o>i;){var a=Math.floor((i+o)/2);r(n[a])<u?i=a+1:o=a}return i},m.indexOf=r(1,m.findIndex,m.sortedIndex),m.lastIndexOf=r(-1,m.findLastIndex),m.range=function(n,t,r){null==t&&(t=n||0,n=0),r=r||1;for(var e=Math.max(Math.ceil((t-n)/r),0),u=Array(e),i=0;e>i;i++,n+=r)u[i]=n;return u};var E=function(n,t,r,e,u){if(!(e instanceof t))return n.apply(r,u);var i=j(n.prototype),o=n.apply(i,u);return m.isObject(o)?o:i};m.bind=function(n,t){if(g&&n.bind===g)return g.apply(n,l.call(arguments,1));if(!m.isFunction(n))throw new TypeError("Bind must be called on a function");var r=l.call(arguments,2),e=function(){return E(n,e,t,this,r.concat(l.call(arguments)))};return e},m.partial=function(n){var t=l.call(arguments,1),r=function(){for(var e=0,u=t.length,i=Array(u),o=0;u>o;o++)i[o]=t[o]===m?arguments[e++]:t[o];for(;e<arguments.length;)i.push(arguments[e++]);return E(n,r,this,this,i)};return r},m.bindAll=function(n){var t,r,e=arguments.length;if(1>=e)throw new Error("bindAll must be passed function names");for(t=1;e>t;t++)r=arguments[t],n[r]=m.bind(n[r],n);return n},m.memoize=function(n,t){var r=function(e){var u=r.cache,i=""+(t?t.apply(this,arguments):e);return m.has(u,i)||(u[i]=n.apply(this,arguments)),u[i]};return r.cache={},r},m.delay=function(n,t){var r=l.call(arguments,2);return setTimeout(function(){return n.apply(null,r)},t)},m.defer=m.partial(m.delay,m,1),m.throttle=function(n,t,r){var e,u,i,o=null,a=0;r||(r={});var c=function(){a=r.leading===!1?0:m.now(),o=null,i=n.apply(e,u),o||(e=u=null)};return function(){var f=m.now();a||r.leading!==!1||(a=f);var l=t-(f-a);return e=this,u=arguments,0>=l||l>t?(o&&(clearTimeout(o),o=null),a=f,i=n.apply(e,u),o||(e=u=null)):o||r.trailing===!1||(o=setTimeout(c,l)),i}},m.debounce=function(n,t,r){var e,u,i,o,a,c=function(){var f=m.now()-o;t>f&&f>=0?e=setTimeout(c,t-f):(e=null,r||(a=n.apply(i,u),e||(i=u=null)))};return function(){i=this,u=arguments,o=m.now();var f=r&&!e;return e||(e=setTimeout(c,t)),f&&(a=n.apply(i,u),i=u=null),a}},m.wrap=function(n,t){return m.partial(t,n)},m.negate=function(n){return function(){return!n.apply(this,arguments)}},m.compose=function(){var n=arguments,t=n.length-1;return function(){for(var r=t,e=n[t].apply(this,arguments);r--;)e=n[r].call(this,e);return e}},m.after=function(n,t){return function(){return--n<1?t.apply(this,arguments):void 0}},m.before=function(n,t){var r;return function(){return--n>0&&(r=t.apply(this,arguments)),1>=n&&(t=null),r}},m.once=m.partial(m.before,2);var M=!{toString:null}.propertyIsEnumerable("toString"),I=["valueOf","isPrototypeOf","toString","propertyIsEnumerable","hasOwnProperty","toLocaleString"];m.keys=function(n){if(!m.isObject(n))return[];if(v)return v(n);var t=[];for(var r in n)m.has(n,r)&&t.push(r);return M&&e(n,t),t},m.allKeys=function(n){if(!m.isObject(n))return[];var t=[];for(var r in n)t.push(r);return M&&e(n,t),t},m.values=function(n){for(var t=m.keys(n),r=t.length,e=Array(r),u=0;r>u;u++)e[u]=n[t[u]];return e},m.mapObject=function(n,t,r){t=x(t,r);for(var e,u=m.keys(n),i=u.length,o={},a=0;i>a;a++)e=u[a],o[e]=t(n[e],e,n);return o},m.pairs=function(n){for(var t=m.keys(n),r=t.length,e=Array(r),u=0;r>u;u++)e[u]=[t[u],n[t[u]]];return e},m.invert=function(n){for(var t={},r=m.keys(n),e=0,u=r.length;u>e;e++)t[n[r[e]]]=r[e];return t},m.functions=m.methods=function(n){var t=[];for(var r in n)m.isFunction(n[r])&&t.push(r);return t.sort()},m.extend=_(m.allKeys),m.extendOwn=m.assign=_(m.keys),m.findKey=function(n,t,r){t=x(t,r);for(var e,u=m.keys(n),i=0,o=u.length;o>i;i++)if(e=u[i],t(n[e],e,n))return e},m.pick=function(n,t,r){var e,u,i={},o=n;if(null==o)return i;m.isFunction(t)?(u=m.allKeys(o),e=b(t,r)):(u=S(arguments,!1,!1,1),e=function(n,t,r){return t in r},o=Object(o));for(var a=0,c=u.length;c>a;a++){var f=u[a],l=o[f];e(l,f,o)&&(i[f]=l)}return i},m.omit=function(n,t,r){if(m.isFunction(t))t=m.negate(t);else{var e=m.map(S(arguments,!1,!1,1),String);t=function(n,t){return!m.contains(e,t)}}return m.pick(n,t,r)},m.defaults=_(m.allKeys,!0),m.create=function(n,t){var r=j(n);return t&&m.extendOwn(r,t),r},m.clone=function(n){return m.isObject(n)?m.isArray(n)?n.slice():m.extend({},n):n},m.tap=function(n,t){return t(n),n},m.isMatch=function(n,t){var r=m.keys(t),e=r.length;if(null==n)return!e;for(var u=Object(n),i=0;e>i;i++){var o=r[i];if(t[o]!==u[o]||!(o in u))return!1}return!0};var N=function(n,t,r,e){if(n===t)return 0!==n||1/n===1/t;if(null==n||null==t)return n===t;n instanceof m&&(n=n._wrapped),t instanceof m&&(t=t._wrapped);var u=s.call(n);if(u!==s.call(t))return!1;switch(u){case"[object RegExp]":case"[object String]":return""+n==""+t;case"[object Number]":return+n!==+n?+t!==+t:0===+n?1/+n===1/t:+n===+t;case"[object Date]":case"[object Boolean]":return+n===+t}var i="[object Array]"===u;if(!i){if("object"!=typeof n||"object"!=typeof t)return!1;var o=n.constructor,a=t.constructor;if(o!==a&&!(m.isFunction(o)&&o instanceof o&&m.isFunction(a)&&a instanceof a)&&"constructor"in n&&"constructor"in t)return!1}r=r||[],e=e||[];for(var c=r.length;c--;)if(r[c]===n)return e[c]===t;if(r.push(n),e.push(t),i){if(c=n.length,c!==t.length)return!1;for(;c--;)if(!N(n[c],t[c],r,e))return!1}else{var f,l=m.keys(n);if(c=l.length,m.keys(t).length!==c)return!1;for(;c--;)if(f=l[c],!m.has(t,f)||!N(n[f],t[f],r,e))return!1}return r.pop(),e.pop(),!0};m.isEqual=function(n,t){return N(n,t)},m.isEmpty=function(n){return null==n?!0:k(n)&&(m.isArray(n)||m.isString(n)||m.isArguments(n))?0===n.length:0===m.keys(n).length},m.isElement=function(n){return!(!n||1!==n.nodeType)},m.isArray=h||function(n){return"[object Array]"===s.call(n)},m.isObject=function(n){var t=typeof n;return"function"===t||"object"===t&&!!n},m.each(["Arguments","Function","String","Number","Date","RegExp","Error"],function(n){m["is"+n]=function(t){return s.call(t)==="[object "+n+"]"}}),m.isArguments(arguments)||(m.isArguments=function(n){return m.has(n,"callee")}),"function"!=typeof/./&&"object"!=typeof Int8Array&&(m.isFunction=function(n){return"function"==typeof n||!1}),m.isFinite=function(n){return isFinite(n)&&!isNaN(parseFloat(n))},m.isNaN=function(n){return m.isNumber(n)&&n!==+n},m.isBoolean=function(n){return n===!0||n===!1||"[object Boolean]"===s.call(n)},m.isNull=function(n){return null===n},m.isUndefined=function(n){return n===void 0},m.has=function(n,t){return null!=n&&p.call(n,t)},m.noConflict=function(){return u._=i,this},m.identity=function(n){return n},m.constant=function(n){return function(){return n}},m.noop=function(){},m.property=w,m.propertyOf=function(n){return null==n?function(){}:function(t){return n[t]}},m.matcher=m.matches=function(n){return n=m.extendOwn({},n),function(t){return m.isMatch(t,n)}},m.times=function(n,t,r){var e=Array(Math.max(0,n));t=b(t,r,1);for(var u=0;n>u;u++)e[u]=t(u);return e},m.random=function(n,t){return null==t&&(t=n,n=0),n+Math.floor(Math.random()*(t-n+1))},m.now=Date.now||function(){return(new Date).getTime()};var B={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;","`":"&#x60;"},T=m.invert(B),R=function(n){var t=function(t){return n[t]},r="(?:"+m.keys(n).join("|")+")",e=RegExp(r),u=RegExp(r,"g");return function(n){return n=null==n?"":""+n,e.test(n)?n.replace(u,t):n}};m.escape=R(B),m.unescape=R(T),m.result=function(n,t,r){var e=null==n?void 0:n[t];return e===void 0&&(e=r),m.isFunction(e)?e.call(n):e};var q=0;m.uniqueId=function(n){var t=++q+"";return n?n+t:t},m.templateSettings={evaluate:/<%([\s\S]+?)%>/g,interpolate:/<%=([\s\S]+?)%>/g,escape:/<%-([\s\S]+?)%>/g};var K=/(.)^/,z={"'":"'","\\":"\\","\r":"r","\n":"n","\u2028":"u2028","\u2029":"u2029"},D=/\\|'|\r|\n|\u2028|\u2029/g,L=function(n){return"\\"+z[n]};m.template=function(n,t,r){!t&&r&&(t=r),t=m.defaults({},t,m.templateSettings);var e=RegExp([(t.escape||K).source,(t.interpolate||K).source,(t.evaluate||K).source].join("|")+"|$","g"),u=0,i="__p+='";n.replace(e,function(t,r,e,o,a){return i+=n.slice(u,a).replace(D,L),u=a+t.length,r?i+="'+\n((__t=("+r+"))==null?'':_.escape(__t))+\n'":e?i+="'+\n((__t=("+e+"))==null?'':__t)+\n'":o&&(i+="';\n"+o+"\n__p+='"),t}),i+="';\n",t.variable||(i="with(obj||{}){\n"+i+"}\n"),i="var __t,__p='',__j=Array.prototype.join,"+"print=function(){__p+=__j.call(arguments,'');};\n"+i+"return __p;\n";try{var o=new Function(t.variable||"obj","_",i)}catch(a){throw a.source=i,a}var c=function(n){return o.call(this,n,m)},f=t.variable||"obj";return c.source="function("+f+"){\n"+i+"}",c},m.chain=function(n){var t=m(n);return t._chain=!0,t};var P=function(n,t){return n._chain?m(t).chain():t};m.mixin=function(n){m.each(m.functions(n),function(t){var r=m[t]=n[t];m.prototype[t]=function(){var n=[this._wrapped];return f.apply(n,arguments),P(this,r.apply(m,n))}})},m.mixin(m),m.each(["pop","push","reverse","shift","sort","splice","unshift"],function(n){var t=o[n];m.prototype[n]=function(){var r=this._wrapped;return t.apply(r,arguments),"shift"!==n&&"splice"!==n||0!==r.length||delete r[0],P(this,r)}}),m.each(["concat","join","slice"],function(n){var t=o[n];m.prototype[n]=function(){return P(this,t.apply(this._wrapped,arguments))}}),m.prototype.value=function(){return this._wrapped},m.prototype.valueOf=m.prototype.toJSON=m.prototype.value,m.prototype.toString=function(){return""+this._wrapped},"function"==typeof define&&define.amd&&define("underscore",[],function(){return m})}).call(this);
//# sourceMappingURL=underscore-min.map;
  /*
   _ _      _       _
   ___| (_) ___| | __  (_)___
   / __| | |/ __| |/ /  | / __|
   \__ \ | | (__|   < _ | \__ \
   |___/_|_|\___|_|\_(_)/ |___/
   |__/

   Version: 1.5.9
   Author: Ken Wheeler
   Website: http://kenwheeler.github.io
   Docs: http://kenwheeler.github.io/slick
   Repo: http://github.com/kenwheeler/slick
   Issues: http://github.com/kenwheeler/slick/issues

   */
  !function(a){"use strict";"function"==typeof define&&define.amd?define('slick',["jquery-private"],a):"undefined"!=typeof exports?module.exports=a(require("jquery-private")):a(jQuery)}(function(a){"use strict";var b=window.Slick||{};b=function(){function c(c,d){var f,e=this;e.defaults={accessibility:!0,adaptiveHeight:!1,appendArrows:a(c),appendDots:a(c),arrows:!0,asNavFor:null,prevArrow:'<button type="button" data-role="none" class="slick-prev" aria-label="Previous" tabindex="0" role="button">Previous</button>',nextArrow:'<button type="button" data-role="none" class="slick-next" aria-label="Next" tabindex="0" role="button">Next</button>',autoplay:!1,autoplaySpeed:3e3,centerMode:!1,centerPadding:"50px",cssEase:"ease",customPaging:function(a,b){return'<button type="button" data-role="none" role="button" aria-required="false" tabindex="0">'+(b+1)+"</button>"},dots:!1,dotsClass:"slick-dots",draggable:!0,easing:"linear",edgeFriction:.35,fade:!1,focusOnSelect:!1,infinite:!0,initialSlide:0,lazyLoad:"ondemand",mobileFirst:!1,pauseOnHover:!0,pauseOnDotsHover:!1,respondTo:"window",responsive:null,rows:1,rtl:!1,slide:"",slidesPerRow:1,slidesToShow:1,slidesToScroll:1,speed:500,swipe:!0,swipeToSlide:!1,touchMove:!0,touchThreshold:5,useCSS:!0,useTransform:!1,variableWidth:!1,vertical:!1,verticalSwiping:!1,waitForAnimate:!0,zIndex:1e3},e.initials={animating:!1,dragging:!1,autoPlayTimer:null,currentDirection:0,currentLeft:null,currentSlide:0,direction:1,$dots:null,listWidth:null,listHeight:null,loadIndex:0,$nextArrow:null,$prevArrow:null,slideCount:null,slideWidth:null,$slideTrack:null,$slides:null,sliding:!1,slideOffset:0,swipeLeft:null,$list:null,touchObject:{},transformsEnabled:!1,unslicked:!1},a.extend(e,e.initials),e.activeBreakpoint=null,e.animType=null,e.animProp=null,e.breakpoints=[],e.breakpointSettings=[],e.cssTransitions=!1,e.hidden="hidden",e.paused=!1,e.positionProp=null,e.respondTo=null,e.rowCount=1,e.shouldClick=!0,e.$slider=a(c),e.$slidesCache=null,e.transformType=null,e.transitionType=null,e.visibilityChange="visibilitychange",e.windowWidth=0,e.windowTimer=null,f=a(c).data("slick")||{},e.options=a.extend({},e.defaults,f,d),e.currentSlide=e.options.initialSlide,e.originalSettings=e.options,"undefined"!=typeof document.mozHidden?(e.hidden="mozHidden",e.visibilityChange="mozvisibilitychange"):"undefined"!=typeof document.webkitHidden&&(e.hidden="webkitHidden",e.visibilityChange="webkitvisibilitychange"),e.autoPlay=a.proxy(e.autoPlay,e),e.autoPlayClear=a.proxy(e.autoPlayClear,e),e.changeSlide=a.proxy(e.changeSlide,e),e.clickHandler=a.proxy(e.clickHandler,e),e.selectHandler=a.proxy(e.selectHandler,e),e.setPosition=a.proxy(e.setPosition,e),e.swipeHandler=a.proxy(e.swipeHandler,e),e.dragHandler=a.proxy(e.dragHandler,e),e.keyHandler=a.proxy(e.keyHandler,e),e.autoPlayIterator=a.proxy(e.autoPlayIterator,e),e.instanceUid=b++,e.htmlExpr=/^(?:\s*(<[\w\W]+>)[^>]*)$/,e.registerBreakpoints(),e.init(!0),e.checkResponsive(!0)}var b=0;return c}(),b.prototype.addSlide=b.prototype.slickAdd=function(b,c,d){var e=this;if("boolean"==typeof c)d=c,c=null;else if(0>c||c>=e.slideCount)return!1;e.unload(),"number"==typeof c?0===c&&0===e.$slides.length?a(b).appendTo(e.$slideTrack):d?a(b).insertBefore(e.$slides.eq(c)):a(b).insertAfter(e.$slides.eq(c)):d===!0?a(b).prependTo(e.$slideTrack):a(b).appendTo(e.$slideTrack),e.$slides=e.$slideTrack.children(this.options.slide),e.$slideTrack.children(this.options.slide).detach(),e.$slideTrack.append(e.$slides),e.$slides.each(function(b,c){a(c).attr("data-slick-index",b)}),e.$slidesCache=e.$slides,e.reinit()},b.prototype.animateHeight=function(){var a=this;if(1===a.options.slidesToShow&&a.options.adaptiveHeight===!0&&a.options.vertical===!1){var b=a.$slides.eq(a.currentSlide).outerHeight(!0);a.$list.animate({height:b},a.options.speed)}},b.prototype.animateSlide=function(b,c){var d={},e=this;e.animateHeight(),e.options.rtl===!0&&e.options.vertical===!1&&(b=-b),e.transformsEnabled===!1?e.options.vertical===!1?e.$slideTrack.animate({left:b},e.options.speed,e.options.easing,c):e.$slideTrack.animate({top:b},e.options.speed,e.options.easing,c):e.cssTransitions===!1?(e.options.rtl===!0&&(e.currentLeft=-e.currentLeft),a({animStart:e.currentLeft}).animate({animStart:b},{duration:e.options.speed,easing:e.options.easing,step:function(a){a=Math.ceil(a),e.options.vertical===!1?(d[e.animType]="translate("+a+"px, 0px)",e.$slideTrack.css(d)):(d[e.animType]="translate(0px,"+a+"px)",e.$slideTrack.css(d))},complete:function(){c&&c.call()}})):(e.applyTransition(),b=Math.ceil(b),e.options.vertical===!1?d[e.animType]="translate3d("+b+"px, 0px, 0px)":d[e.animType]="translate3d(0px,"+b+"px, 0px)",e.$slideTrack.css(d),c&&setTimeout(function(){e.disableTransition(),c.call()},e.options.speed))},b.prototype.asNavFor=function(b){var c=this,d=c.options.asNavFor;d&&null!==d&&(d=a(d).not(c.$slider)),null!==d&&"object"==typeof d&&d.each(function(){var c=a(this).slick("getSlick");c.unslicked||c.slideHandler(b,!0)})},b.prototype.applyTransition=function(a){var b=this,c={};b.options.fade===!1?c[b.transitionType]=b.transformType+" "+b.options.speed+"ms "+b.options.cssEase:c[b.transitionType]="opacity "+b.options.speed+"ms "+b.options.cssEase,b.options.fade===!1?b.$slideTrack.css(c):b.$slides.eq(a).css(c)},b.prototype.autoPlay=function(){var a=this;a.autoPlayTimer&&clearInterval(a.autoPlayTimer),a.slideCount>a.options.slidesToShow&&a.paused!==!0&&(a.autoPlayTimer=setInterval(a.autoPlayIterator,a.options.autoplaySpeed))},b.prototype.autoPlayClear=function(){var a=this;a.autoPlayTimer&&clearInterval(a.autoPlayTimer)},b.prototype.autoPlayIterator=function(){var a=this;a.options.infinite===!1?1===a.direction?(a.currentSlide+1===a.slideCount-1&&(a.direction=0),a.slideHandler(a.currentSlide+a.options.slidesToScroll)):(a.currentSlide-1===0&&(a.direction=1),a.slideHandler(a.currentSlide-a.options.slidesToScroll)):a.slideHandler(a.currentSlide+a.options.slidesToScroll)},b.prototype.buildArrows=function(){var b=this;b.options.arrows===!0&&(b.$prevArrow=a(b.options.prevArrow).addClass("slick-arrow"),b.$nextArrow=a(b.options.nextArrow).addClass("slick-arrow"),b.slideCount>b.options.slidesToShow?(b.$prevArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"),b.$nextArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"),b.htmlExpr.test(b.options.prevArrow)&&b.$prevArrow.prependTo(b.options.appendArrows),b.htmlExpr.test(b.options.nextArrow)&&b.$nextArrow.appendTo(b.options.appendArrows),b.options.infinite!==!0&&b.$prevArrow.addClass("slick-disabled").attr("aria-disabled","true")):b.$prevArrow.add(b.$nextArrow).addClass("slick-hidden").attr({"aria-disabled":"true",tabindex:"-1"}))},b.prototype.buildDots=function(){var c,d,b=this;if(b.options.dots===!0&&b.slideCount>b.options.slidesToShow){for(d='<ul class="'+b.options.dotsClass+'">',c=0;c<=b.getDotCount();c+=1)d+="<li>"+b.options.customPaging.call(this,b,c)+"</li>";d+="</ul>",b.$dots=a(d).appendTo(b.options.appendDots),b.$dots.find("li").first().addClass("slick-active").attr("aria-hidden","false")}},b.prototype.buildOut=function(){var b=this;b.$slides=b.$slider.children(b.options.slide+":not(.slick-cloned)").addClass("slick-slide"),b.slideCount=b.$slides.length,b.$slides.each(function(b,c){a(c).attr("data-slick-index",b).data("originalStyling",a(c).attr("style")||"")}),b.$slider.addClass("slick-slider"),b.$slideTrack=0===b.slideCount?a('<div class="slick-track"/>').appendTo(b.$slider):b.$slides.wrapAll('<div class="slick-track"/>').parent(),b.$list=b.$slideTrack.wrap('<div aria-live="polite" class="slick-list"/>').parent(),b.$slideTrack.css("opacity",0),(b.options.centerMode===!0||b.options.swipeToSlide===!0)&&(b.options.slidesToScroll=1),a("img[data-lazy]",b.$slider).not("[src]").addClass("slick-loading"),b.setupInfinite(),b.buildArrows(),b.buildDots(),b.updateDots(),b.setSlideClasses("number"==typeof b.currentSlide?b.currentSlide:0),b.options.draggable===!0&&b.$list.addClass("draggable")},b.prototype.buildRows=function(){var b,c,d,e,f,g,h,a=this;if(e=document.createDocumentFragment(),g=a.$slider.children(),a.options.rows>1){for(h=a.options.slidesPerRow*a.options.rows,f=Math.ceil(g.length/h),b=0;f>b;b++){var i=document.createElement("div");for(c=0;c<a.options.rows;c++){var j=document.createElement("div");for(d=0;d<a.options.slidesPerRow;d++){var k=b*h+(c*a.options.slidesPerRow+d);g.get(k)&&j.appendChild(g.get(k))}i.appendChild(j)}e.appendChild(i)}a.$slider.html(e),a.$slider.children().children().children().css({width:100/a.options.slidesPerRow+"%",display:"inline-block"})}},b.prototype.checkResponsive=function(b,c){var e,f,g,d=this,h=!1,i=d.$slider.width(),j=window.innerWidth||a(window).width();if("window"===d.respondTo?g=j:"slider"===d.respondTo?g=i:"min"===d.respondTo&&(g=Math.min(j,i)),d.options.responsive&&d.options.responsive.length&&null!==d.options.responsive){f=null;for(e in d.breakpoints)d.breakpoints.hasOwnProperty(e)&&(d.originalSettings.mobileFirst===!1?g<d.breakpoints[e]&&(f=d.breakpoints[e]):g>d.breakpoints[e]&&(f=d.breakpoints[e]));null!==f?null!==d.activeBreakpoint?(f!==d.activeBreakpoint||c)&&(d.activeBreakpoint=f,"unslick"===d.breakpointSettings[f]?d.unslick(f):(d.options=a.extend({},d.originalSettings,d.breakpointSettings[f]),b===!0&&(d.currentSlide=d.options.initialSlide),d.refresh(b)),h=f):(d.activeBreakpoint=f,"unslick"===d.breakpointSettings[f]?d.unslick(f):(d.options=a.extend({},d.originalSettings,d.breakpointSettings[f]),b===!0&&(d.currentSlide=d.options.initialSlide),d.refresh(b)),h=f):null!==d.activeBreakpoint&&(d.activeBreakpoint=null,d.options=d.originalSettings,b===!0&&(d.currentSlide=d.options.initialSlide),d.refresh(b),h=f),b||h===!1||d.$slider.trigger("breakpoint",[d,h])}},b.prototype.changeSlide=function(b,c){var f,g,h,d=this,e=a(b.target);switch(e.is("a")&&b.preventDefault(),e.is("li")||(e=e.closest("li")),h=d.slideCount%d.options.slidesToScroll!==0,f=h?0:(d.slideCount-d.currentSlide)%d.options.slidesToScroll,b.data.message){case"previous":g=0===f?d.options.slidesToScroll:d.options.slidesToShow-f,d.slideCount>d.options.slidesToShow&&d.slideHandler(d.currentSlide-g,!1,c);break;case"next":g=0===f?d.options.slidesToScroll:f,d.slideCount>d.options.slidesToShow&&d.slideHandler(d.currentSlide+g,!1,c);break;case"index":var i=0===b.data.index?0:b.data.index||e.index()*d.options.slidesToScroll;d.slideHandler(d.checkNavigable(i),!1,c),e.children().trigger("focus");break;default:return}},b.prototype.checkNavigable=function(a){var c,d,b=this;if(c=b.getNavigableIndexes(),d=0,a>c[c.length-1])a=c[c.length-1];else for(var e in c){if(a<c[e]){a=d;break}d=c[e]}return a},b.prototype.cleanUpEvents=function(){var b=this;b.options.dots&&null!==b.$dots&&(a("li",b.$dots).off("click.slick",b.changeSlide),b.options.pauseOnDotsHover===!0&&b.options.autoplay===!0&&a("li",b.$dots).off("mouseenter.slick",a.proxy(b.setPaused,b,!0)).off("mouseleave.slick",a.proxy(b.setPaused,b,!1))),b.options.arrows===!0&&b.slideCount>b.options.slidesToShow&&(b.$prevArrow&&b.$prevArrow.off("click.slick",b.changeSlide),b.$nextArrow&&b.$nextArrow.off("click.slick",b.changeSlide)),b.$list.off("touchstart.slick mousedown.slick",b.swipeHandler),b.$list.off("touchmove.slick mousemove.slick",b.swipeHandler),b.$list.off("touchend.slick mouseup.slick",b.swipeHandler),b.$list.off("touchcancel.slick mouseleave.slick",b.swipeHandler),b.$list.off("click.slick",b.clickHandler),a(document).off(b.visibilityChange,b.visibility),b.$list.off("mouseenter.slick",a.proxy(b.setPaused,b,!0)),b.$list.off("mouseleave.slick",a.proxy(b.setPaused,b,!1)),b.options.accessibility===!0&&b.$list.off("keydown.slick",b.keyHandler),b.options.focusOnSelect===!0&&a(b.$slideTrack).children().off("click.slick",b.selectHandler),a(window).off("orientationchange.slick.slick-"+b.instanceUid,b.orientationChange),a(window).off("resize.slick.slick-"+b.instanceUid,b.resize),a("[draggable!=true]",b.$slideTrack).off("dragstart",b.preventDefault),a(window).off("load.slick.slick-"+b.instanceUid,b.setPosition),a(document).off("ready.slick.slick-"+b.instanceUid,b.setPosition)},b.prototype.cleanUpRows=function(){var b,a=this;a.options.rows>1&&(b=a.$slides.children().children(),b.removeAttr("style"),a.$slider.html(b))},b.prototype.clickHandler=function(a){var b=this;b.shouldClick===!1&&(a.stopImmediatePropagation(),a.stopPropagation(),a.preventDefault())},b.prototype.destroy=function(b){var c=this;c.autoPlayClear(),c.touchObject={},c.cleanUpEvents(),a(".slick-cloned",c.$slider).detach(),c.$dots&&c.$dots.remove(),c.$prevArrow&&c.$prevArrow.length&&(c.$prevArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display",""),c.htmlExpr.test(c.options.prevArrow)&&c.$prevArrow.remove()),c.$nextArrow&&c.$nextArrow.length&&(c.$nextArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display",""),c.htmlExpr.test(c.options.nextArrow)&&c.$nextArrow.remove()),c.$slides&&(c.$slides.removeClass("slick-slide slick-active slick-center slick-visible slick-current").removeAttr("aria-hidden").removeAttr("data-slick-index").each(function(){a(this).attr("style",a(this).data("originalStyling"))}),c.$slideTrack.children(this.options.slide).detach(),c.$slideTrack.detach(),c.$list.detach(),c.$slider.append(c.$slides)),c.cleanUpRows(),c.$slider.removeClass("slick-slider"),c.$slider.removeClass("slick-initialized"),c.unslicked=!0,b||c.$slider.trigger("destroy",[c])},b.prototype.disableTransition=function(a){var b=this,c={};c[b.transitionType]="",b.options.fade===!1?b.$slideTrack.css(c):b.$slides.eq(a).css(c)},b.prototype.fadeSlide=function(a,b){var c=this;c.cssTransitions===!1?(c.$slides.eq(a).css({zIndex:c.options.zIndex}),c.$slides.eq(a).animate({opacity:1},c.options.speed,c.options.easing,b)):(c.applyTransition(a),c.$slides.eq(a).css({opacity:1,zIndex:c.options.zIndex}),b&&setTimeout(function(){c.disableTransition(a),b.call()},c.options.speed))},b.prototype.fadeSlideOut=function(a){var b=this;b.cssTransitions===!1?b.$slides.eq(a).animate({opacity:0,zIndex:b.options.zIndex-2},b.options.speed,b.options.easing):(b.applyTransition(a),b.$slides.eq(a).css({opacity:0,zIndex:b.options.zIndex-2}))},b.prototype.filterSlides=b.prototype.slickFilter=function(a){var b=this;null!==a&&(b.$slidesCache=b.$slides,b.unload(),b.$slideTrack.children(this.options.slide).detach(),b.$slidesCache.filter(a).appendTo(b.$slideTrack),b.reinit())},b.prototype.getCurrent=b.prototype.slickCurrentSlide=function(){var a=this;return a.currentSlide},b.prototype.getDotCount=function(){var a=this,b=0,c=0,d=0;if(a.options.infinite===!0)for(;b<a.slideCount;)++d,b=c+a.options.slidesToScroll,c+=a.options.slidesToScroll<=a.options.slidesToShow?a.options.slidesToScroll:a.options.slidesToShow;else if(a.options.centerMode===!0)d=a.slideCount;else for(;b<a.slideCount;)++d,b=c+a.options.slidesToScroll,c+=a.options.slidesToScroll<=a.options.slidesToShow?a.options.slidesToScroll:a.options.slidesToShow;return d-1},b.prototype.getLeft=function(a){var c,d,f,b=this,e=0;return b.slideOffset=0,d=b.$slides.first().outerHeight(!0),b.options.infinite===!0?(b.slideCount>b.options.slidesToShow&&(b.slideOffset=b.slideWidth*b.options.slidesToShow*-1,e=d*b.options.slidesToShow*-1),b.slideCount%b.options.slidesToScroll!==0&&a+b.options.slidesToScroll>b.slideCount&&b.slideCount>b.options.slidesToShow&&(a>b.slideCount?(b.slideOffset=(b.options.slidesToShow-(a-b.slideCount))*b.slideWidth*-1,e=(b.options.slidesToShow-(a-b.slideCount))*d*-1):(b.slideOffset=b.slideCount%b.options.slidesToScroll*b.slideWidth*-1,e=b.slideCount%b.options.slidesToScroll*d*-1))):a+b.options.slidesToShow>b.slideCount&&(b.slideOffset=(a+b.options.slidesToShow-b.slideCount)*b.slideWidth,e=(a+b.options.slidesToShow-b.slideCount)*d),b.slideCount<=b.options.slidesToShow&&(b.slideOffset=0,e=0),b.options.centerMode===!0&&b.options.infinite===!0?b.slideOffset+=b.slideWidth*Math.floor(b.options.slidesToShow/2)-b.slideWidth:b.options.centerMode===!0&&(b.slideOffset=0,b.slideOffset+=b.slideWidth*Math.floor(b.options.slidesToShow/2)),c=b.options.vertical===!1?a*b.slideWidth*-1+b.slideOffset:a*d*-1+e,b.options.variableWidth===!0&&(f=b.slideCount<=b.options.slidesToShow||b.options.infinite===!1?b.$slideTrack.children(".slick-slide").eq(a):b.$slideTrack.children(".slick-slide").eq(a+b.options.slidesToShow),c=b.options.rtl===!0?f[0]?-1*(b.$slideTrack.width()-f[0].offsetLeft-f.width()):0:f[0]?-1*f[0].offsetLeft:0,b.options.centerMode===!0&&(f=b.slideCount<=b.options.slidesToShow||b.options.infinite===!1?b.$slideTrack.children(".slick-slide").eq(a):b.$slideTrack.children(".slick-slide").eq(a+b.options.slidesToShow+1),c=b.options.rtl===!0?f[0]?-1*(b.$slideTrack.width()-f[0].offsetLeft-f.width()):0:f[0]?-1*f[0].offsetLeft:0,c+=(b.$list.width()-f.outerWidth())/2)),c},b.prototype.getOption=b.prototype.slickGetOption=function(a){var b=this;return b.options[a]},b.prototype.getNavigableIndexes=function(){var e,a=this,b=0,c=0,d=[];for(a.options.infinite===!1?e=a.slideCount:(b=-1*a.options.slidesToScroll,c=-1*a.options.slidesToScroll,e=2*a.slideCount);e>b;)d.push(b),b=c+a.options.slidesToScroll,c+=a.options.slidesToScroll<=a.options.slidesToShow?a.options.slidesToScroll:a.options.slidesToShow;return d},b.prototype.getSlick=function(){return this},b.prototype.getSlideCount=function(){var c,d,e,b=this;return e=b.options.centerMode===!0?b.slideWidth*Math.floor(b.options.slidesToShow/2):0,b.options.swipeToSlide===!0?(b.$slideTrack.find(".slick-slide").each(function(c,f){return f.offsetLeft-e+a(f).outerWidth()/2>-1*b.swipeLeft?(d=f,!1):void 0}),c=Math.abs(a(d).attr("data-slick-index")-b.currentSlide)||1):b.options.slidesToScroll},b.prototype.goTo=b.prototype.slickGoTo=function(a,b){var c=this;c.changeSlide({data:{message:"index",index:parseInt(a)}},b)},b.prototype.init=function(b){var c=this;a(c.$slider).hasClass("slick-initialized")||(a(c.$slider).addClass("slick-initialized"),c.buildRows(),c.buildOut(),c.setProps(),c.startLoad(),c.loadSlider(),c.initializeEvents(),c.updateArrows(),c.updateDots()),b&&c.$slider.trigger("init",[c]),c.options.accessibility===!0&&c.initADA()},b.prototype.initArrowEvents=function(){var a=this;a.options.arrows===!0&&a.slideCount>a.options.slidesToShow&&(a.$prevArrow.on("click.slick",{message:"previous"},a.changeSlide),a.$nextArrow.on("click.slick",{message:"next"},a.changeSlide))},b.prototype.initDotEvents=function(){var b=this;b.options.dots===!0&&b.slideCount>b.options.slidesToShow&&a("li",b.$dots).on("click.slick",{message:"index"},b.changeSlide),b.options.dots===!0&&b.options.pauseOnDotsHover===!0&&b.options.autoplay===!0&&a("li",b.$dots).on("mouseenter.slick",a.proxy(b.setPaused,b,!0)).on("mouseleave.slick",a.proxy(b.setPaused,b,!1))},b.prototype.initializeEvents=function(){var b=this;b.initArrowEvents(),b.initDotEvents(),b.$list.on("touchstart.slick mousedown.slick",{action:"start"},b.swipeHandler),b.$list.on("touchmove.slick mousemove.slick",{action:"move"},b.swipeHandler),b.$list.on("touchend.slick mouseup.slick",{action:"end"},b.swipeHandler),b.$list.on("touchcancel.slick mouseleave.slick",{action:"end"},b.swipeHandler),b.$list.on("click.slick",b.clickHandler),a(document).on(b.visibilityChange,a.proxy(b.visibility,b)),b.$list.on("mouseenter.slick",a.proxy(b.setPaused,b,!0)),b.$list.on("mouseleave.slick",a.proxy(b.setPaused,b,!1)),b.options.accessibility===!0&&b.$list.on("keydown.slick",b.keyHandler),b.options.focusOnSelect===!0&&a(b.$slideTrack).children().on("click.slick",b.selectHandler),a(window).on("orientationchange.slick.slick-"+b.instanceUid,a.proxy(b.orientationChange,b)),a(window).on("resize.slick.slick-"+b.instanceUid,a.proxy(b.resize,b)),a("[draggable!=true]",b.$slideTrack).on("dragstart",b.preventDefault),a(window).on("load.slick.slick-"+b.instanceUid,b.setPosition),a(document).on("ready.slick.slick-"+b.instanceUid,b.setPosition)},b.prototype.initUI=function(){var a=this;a.options.arrows===!0&&a.slideCount>a.options.slidesToShow&&(a.$prevArrow.show(),a.$nextArrow.show()),a.options.dots===!0&&a.slideCount>a.options.slidesToShow&&a.$dots.show(),a.options.autoplay===!0&&a.autoPlay()},b.prototype.keyHandler=function(a){var b=this;a.target.tagName.match("TEXTAREA|INPUT|SELECT")||(37===a.keyCode&&b.options.accessibility===!0?b.changeSlide({data:{message:"previous"}}):39===a.keyCode&&b.options.accessibility===!0&&b.changeSlide({data:{message:"next"}}))},b.prototype.lazyLoad=function(){function g(b){a("img[data-lazy]",b).each(function(){var b=a(this),c=a(this).attr("data-lazy"),d=document.createElement("img");d.onload=function(){b.animate({opacity:0},100,function(){b.attr("src",c).animate({opacity:1},200,function(){b.removeAttr("data-lazy").removeClass("slick-loading")})})},d.src=c})}var c,d,e,f,b=this;b.options.centerMode===!0?b.options.infinite===!0?(e=b.currentSlide+(b.options.slidesToShow/2+1),f=e+b.options.slidesToShow+2):(e=Math.max(0,b.currentSlide-(b.options.slidesToShow/2+1)),f=2+(b.options.slidesToShow/2+1)+b.currentSlide):(e=b.options.infinite?b.options.slidesToShow+b.currentSlide:b.currentSlide,f=e+b.options.slidesToShow,b.options.fade===!0&&(e>0&&e--,f<=b.slideCount&&f++)),c=b.$slider.find(".slick-slide").slice(e,f),g(c),b.slideCount<=b.options.slidesToShow?(d=b.$slider.find(".slick-slide"),g(d)):b.currentSlide>=b.slideCount-b.options.slidesToShow?(d=b.$slider.find(".slick-cloned").slice(0,b.options.slidesToShow),g(d)):0===b.currentSlide&&(d=b.$slider.find(".slick-cloned").slice(-1*b.options.slidesToShow),g(d))},b.prototype.loadSlider=function(){var a=this;a.setPosition(),a.$slideTrack.css({opacity:1}),a.$slider.removeClass("slick-loading"),a.initUI(),"progressive"===a.options.lazyLoad&&a.progressiveLazyLoad()},b.prototype.next=b.prototype.slickNext=function(){var a=this;a.changeSlide({data:{message:"next"}})},b.prototype.orientationChange=function(){var a=this;a.checkResponsive(),a.setPosition()},b.prototype.pause=b.prototype.slickPause=function(){var a=this;a.autoPlayClear(),a.paused=!0},b.prototype.play=b.prototype.slickPlay=function(){var a=this;a.paused=!1,a.autoPlay()},b.prototype.postSlide=function(a){var b=this;b.$slider.trigger("afterChange",[b,a]),b.animating=!1,b.setPosition(),b.swipeLeft=null,b.options.autoplay===!0&&b.paused===!1&&b.autoPlay(),b.options.accessibility===!0&&b.initADA()},b.prototype.prev=b.prototype.slickPrev=function(){var a=this;a.changeSlide({data:{message:"previous"}})},b.prototype.preventDefault=function(a){a.preventDefault()},b.prototype.progressiveLazyLoad=function(){var c,d,b=this;c=a("img[data-lazy]",b.$slider).length,c>0&&(d=a("img[data-lazy]",b.$slider).first(),d.attr("src",null),d.attr("src",d.attr("data-lazy")).removeClass("slick-loading").load(function(){d.removeAttr("data-lazy"),b.progressiveLazyLoad(),b.options.adaptiveHeight===!0&&b.setPosition()}).error(function(){d.removeAttr("data-lazy"),b.progressiveLazyLoad()}))},b.prototype.refresh=function(b){var d,e,c=this;e=c.slideCount-c.options.slidesToShow,c.options.infinite||(c.slideCount<=c.options.slidesToShow?c.currentSlide=0:c.currentSlide>e&&(c.currentSlide=e)),d=c.currentSlide,c.destroy(!0),a.extend(c,c.initials,{currentSlide:d}),c.init(),b||c.changeSlide({data:{message:"index",index:d}},!1)},b.prototype.registerBreakpoints=function(){var c,d,e,b=this,f=b.options.responsive||null;if("array"===a.type(f)&&f.length){b.respondTo=b.options.respondTo||"window";for(c in f)if(e=b.breakpoints.length-1,d=f[c].breakpoint,f.hasOwnProperty(c)){for(;e>=0;)b.breakpoints[e]&&b.breakpoints[e]===d&&b.breakpoints.splice(e,1),e--;b.breakpoints.push(d),b.breakpointSettings[d]=f[c].settings}b.breakpoints.sort(function(a,c){return b.options.mobileFirst?a-c:c-a})}},b.prototype.reinit=function(){var b=this;b.$slides=b.$slideTrack.children(b.options.slide).addClass("slick-slide"),b.slideCount=b.$slides.length,b.currentSlide>=b.slideCount&&0!==b.currentSlide&&(b.currentSlide=b.currentSlide-b.options.slidesToScroll),b.slideCount<=b.options.slidesToShow&&(b.currentSlide=0),b.registerBreakpoints(),b.setProps(),b.setupInfinite(),b.buildArrows(),b.updateArrows(),b.initArrowEvents(),b.buildDots(),b.updateDots(),b.initDotEvents(),b.checkResponsive(!1,!0),b.options.focusOnSelect===!0&&a(b.$slideTrack).children().on("click.slick",b.selectHandler),b.setSlideClasses(0),b.setPosition(),b.$slider.trigger("reInit",[b]),b.options.autoplay===!0&&b.focusHandler()},b.prototype.resize=function(){var b=this;a(window).width()!==b.windowWidth&&(clearTimeout(b.windowDelay),b.windowDelay=window.setTimeout(function(){b.windowWidth=a(window).width(),b.checkResponsive(),b.unslicked||b.setPosition()},50))},b.prototype.removeSlide=b.prototype.slickRemove=function(a,b,c){var d=this;return"boolean"==typeof a?(b=a,a=b===!0?0:d.slideCount-1):a=b===!0?--a:a,d.slideCount<1||0>a||a>d.slideCount-1?!1:(d.unload(),c===!0?d.$slideTrack.children().remove():d.$slideTrack.children(this.options.slide).eq(a).remove(),d.$slides=d.$slideTrack.children(this.options.slide),d.$slideTrack.children(this.options.slide).detach(),d.$slideTrack.append(d.$slides),d.$slidesCache=d.$slides,void d.reinit())},b.prototype.setCSS=function(a){var d,e,b=this,c={};b.options.rtl===!0&&(a=-a),d="left"==b.positionProp?Math.ceil(a)+"px":"0px",e="top"==b.positionProp?Math.ceil(a)+"px":"0px",c[b.positionProp]=a,b.transformsEnabled===!1?b.$slideTrack.css(c):(c={},b.cssTransitions===!1?(c[b.animType]="translate("+d+", "+e+")",b.$slideTrack.css(c)):(c[b.animType]="translate3d("+d+", "+e+", 0px)",b.$slideTrack.css(c)))},b.prototype.setDimensions=function(){var a=this;a.options.vertical===!1?a.options.centerMode===!0&&a.$list.css({padding:"0px "+a.options.centerPadding}):(a.$list.height(a.$slides.first().outerHeight(!0)*a.options.slidesToShow),a.options.centerMode===!0&&a.$list.css({padding:a.options.centerPadding+" 0px"})),a.listWidth=a.$list.width(),a.listHeight=a.$list.height(),a.options.vertical===!1&&a.options.variableWidth===!1?(a.slideWidth=Math.ceil(a.listWidth/a.options.slidesToShow),a.$slideTrack.width(Math.ceil(a.slideWidth*a.$slideTrack.children(".slick-slide").length))):a.options.variableWidth===!0?a.$slideTrack.width(5e3*a.slideCount):(a.slideWidth=Math.ceil(a.listWidth),a.$slideTrack.height(Math.ceil(a.$slides.first().outerHeight(!0)*a.$slideTrack.children(".slick-slide").length)));var b=a.$slides.first().outerWidth(!0)-a.$slides.first().width();a.options.variableWidth===!1&&a.$slideTrack.children(".slick-slide").width(a.slideWidth-b)},b.prototype.setFade=function(){var c,b=this;b.$slides.each(function(d,e){c=b.slideWidth*d*-1,b.options.rtl===!0?a(e).css({position:"relative",right:c,top:0,zIndex:b.options.zIndex-2,opacity:0}):a(e).css({position:"relative",left:c,top:0,zIndex:b.options.zIndex-2,opacity:0})}),b.$slides.eq(b.currentSlide).css({zIndex:b.options.zIndex-1,opacity:1})},b.prototype.setHeight=function(){var a=this;if(1===a.options.slidesToShow&&a.options.adaptiveHeight===!0&&a.options.vertical===!1){var b=a.$slides.eq(a.currentSlide).outerHeight(!0);a.$list.css("height",b)}},b.prototype.setOption=b.prototype.slickSetOption=function(b,c,d){var f,g,e=this;if("responsive"===b&&"array"===a.type(c))for(g in c)if("array"!==a.type(e.options.responsive))e.options.responsive=[c[g]];else{for(f=e.options.responsive.length-1;f>=0;)e.options.responsive[f].breakpoint===c[g].breakpoint&&e.options.responsive.splice(f,1),f--;e.options.responsive.push(c[g])}else e.options[b]=c;d===!0&&(e.unload(),e.reinit())},b.prototype.setPosition=function(){var a=this;a.setDimensions(),a.setHeight(),a.options.fade===!1?a.setCSS(a.getLeft(a.currentSlide)):a.setFade(),a.$slider.trigger("setPosition",[a])},b.prototype.setProps=function(){var a=this,b=document.body.style;a.positionProp=a.options.vertical===!0?"top":"left","top"===a.positionProp?a.$slider.addClass("slick-vertical"):a.$slider.removeClass("slick-vertical"),(void 0!==b.WebkitTransition||void 0!==b.MozTransition||void 0!==b.msTransition)&&a.options.useCSS===!0&&(a.cssTransitions=!0),a.options.fade&&("number"==typeof a.options.zIndex?a.options.zIndex<3&&(a.options.zIndex=3):a.options.zIndex=a.defaults.zIndex),void 0!==b.OTransform&&(a.animType="OTransform",a.transformType="-o-transform",a.transitionType="OTransition",void 0===b.perspectiveProperty&&void 0===b.webkitPerspective&&(a.animType=!1)),void 0!==b.MozTransform&&(a.animType="MozTransform",a.transformType="-moz-transform",a.transitionType="MozTransition",void 0===b.perspectiveProperty&&void 0===b.MozPerspective&&(a.animType=!1)),void 0!==b.webkitTransform&&(a.animType="webkitTransform",a.transformType="-webkit-transform",a.transitionType="webkitTransition",void 0===b.perspectiveProperty&&void 0===b.webkitPerspective&&(a.animType=!1)),void 0!==b.msTransform&&(a.animType="msTransform",a.transformType="-ms-transform",a.transitionType="msTransition",void 0===b.msTransform&&(a.animType=!1)),void 0!==b.transform&&a.animType!==!1&&(a.animType="transform",a.transformType="transform",a.transitionType="transition"),a.transformsEnabled=a.options.useTransform&&null!==a.animType&&a.animType!==!1},b.prototype.setSlideClasses=function(a){var c,d,e,f,b=this;d=b.$slider.find(".slick-slide").removeClass("slick-active slick-center slick-current").attr("aria-hidden","true"),b.$slides.eq(a).addClass("slick-current"),b.options.centerMode===!0?(c=Math.floor(b.options.slidesToShow/2),b.options.infinite===!0&&(a>=c&&a<=b.slideCount-1-c?b.$slides.slice(a-c,a+c+1).addClass("slick-active").attr("aria-hidden","false"):(e=b.options.slidesToShow+a,d.slice(e-c+1,e+c+2).addClass("slick-active").attr("aria-hidden","false")),0===a?d.eq(d.length-1-b.options.slidesToShow).addClass("slick-center"):a===b.slideCount-1&&d.eq(b.options.slidesToShow).addClass("slick-center")),b.$slides.eq(a).addClass("slick-center")):a>=0&&a<=b.slideCount-b.options.slidesToShow?b.$slides.slice(a,a+b.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false"):d.length<=b.options.slidesToShow?d.addClass("slick-active").attr("aria-hidden","false"):(f=b.slideCount%b.options.slidesToShow,e=b.options.infinite===!0?b.options.slidesToShow+a:a,b.options.slidesToShow==b.options.slidesToScroll&&b.slideCount-a<b.options.slidesToShow?d.slice(e-(b.options.slidesToShow-f),e+f).addClass("slick-active").attr("aria-hidden","false"):d.slice(e,e+b.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false")),"ondemand"===b.options.lazyLoad&&b.lazyLoad()},b.prototype.setupInfinite=function(){var c,d,e,b=this;if(b.options.fade===!0&&(b.options.centerMode=!1),b.options.infinite===!0&&b.options.fade===!1&&(d=null,b.slideCount>b.options.slidesToShow)){for(e=b.options.centerMode===!0?b.options.slidesToShow+1:b.options.slidesToShow,c=b.slideCount;c>b.slideCount-e;c-=1)d=c-1,a(b.$slides[d]).clone(!0).attr("id","").attr("data-slick-index",d-b.slideCount).prependTo(b.$slideTrack).addClass("slick-cloned");for(c=0;e>c;c+=1)d=c,a(b.$slides[d]).clone(!0).attr("id","").attr("data-slick-index",d+b.slideCount).appendTo(b.$slideTrack).addClass("slick-cloned");b.$slideTrack.find(".slick-cloned").find("[id]").each(function(){a(this).attr("id","")})}},b.prototype.setPaused=function(a){var b=this;b.options.autoplay===!0&&b.options.pauseOnHover===!0&&(b.paused=a,a?b.autoPlayClear():b.autoPlay())},b.prototype.selectHandler=function(b){var c=this,d=a(b.target).is(".slick-slide")?a(b.target):a(b.target).parents(".slick-slide"),e=parseInt(d.attr("data-slick-index"));return e||(e=0),c.slideCount<=c.options.slidesToShow?(c.setSlideClasses(e),void c.asNavFor(e)):void c.slideHandler(e)},b.prototype.slideHandler=function(a,b,c){var d,e,f,g,h=null,i=this;return b=b||!1,i.animating===!0&&i.options.waitForAnimate===!0||i.options.fade===!0&&i.currentSlide===a||i.slideCount<=i.options.slidesToShow?void 0:(b===!1&&i.asNavFor(a),d=a,h=i.getLeft(d),g=i.getLeft(i.currentSlide),i.currentLeft=null===i.swipeLeft?g:i.swipeLeft,i.options.infinite===!1&&i.options.centerMode===!1&&(0>a||a>i.getDotCount()*i.options.slidesToScroll)?void(i.options.fade===!1&&(d=i.currentSlide,c!==!0?i.animateSlide(g,function(){i.postSlide(d);
  }):i.postSlide(d))):i.options.infinite===!1&&i.options.centerMode===!0&&(0>a||a>i.slideCount-i.options.slidesToScroll)?void(i.options.fade===!1&&(d=i.currentSlide,c!==!0?i.animateSlide(g,function(){i.postSlide(d)}):i.postSlide(d))):(i.options.autoplay===!0&&clearInterval(i.autoPlayTimer),e=0>d?i.slideCount%i.options.slidesToScroll!==0?i.slideCount-i.slideCount%i.options.slidesToScroll:i.slideCount+d:d>=i.slideCount?i.slideCount%i.options.slidesToScroll!==0?0:d-i.slideCount:d,i.animating=!0,i.$slider.trigger("beforeChange",[i,i.currentSlide,e]),f=i.currentSlide,i.currentSlide=e,i.setSlideClasses(i.currentSlide),i.updateDots(),i.updateArrows(),i.options.fade===!0?(c!==!0?(i.fadeSlideOut(f),i.fadeSlide(e,function(){i.postSlide(e)})):i.postSlide(e),void i.animateHeight()):void(c!==!0?i.animateSlide(h,function(){i.postSlide(e)}):i.postSlide(e))))},b.prototype.startLoad=function(){var a=this;a.options.arrows===!0&&a.slideCount>a.options.slidesToShow&&(a.$prevArrow.hide(),a.$nextArrow.hide()),a.options.dots===!0&&a.slideCount>a.options.slidesToShow&&a.$dots.hide(),a.$slider.addClass("slick-loading")},b.prototype.swipeDirection=function(){var a,b,c,d,e=this;return a=e.touchObject.startX-e.touchObject.curX,b=e.touchObject.startY-e.touchObject.curY,c=Math.atan2(b,a),d=Math.round(180*c/Math.PI),0>d&&(d=360-Math.abs(d)),45>=d&&d>=0?e.options.rtl===!1?"left":"right":360>=d&&d>=315?e.options.rtl===!1?"left":"right":d>=135&&225>=d?e.options.rtl===!1?"right":"left":e.options.verticalSwiping===!0?d>=35&&135>=d?"left":"right":"vertical"},b.prototype.swipeEnd=function(a){var c,b=this;if(b.dragging=!1,b.shouldClick=b.touchObject.swipeLength>10?!1:!0,void 0===b.touchObject.curX)return!1;if(b.touchObject.edgeHit===!0&&b.$slider.trigger("edge",[b,b.swipeDirection()]),b.touchObject.swipeLength>=b.touchObject.minSwipe)switch(b.swipeDirection()){case"left":c=b.options.swipeToSlide?b.checkNavigable(b.currentSlide+b.getSlideCount()):b.currentSlide+b.getSlideCount(),b.slideHandler(c),b.currentDirection=0,b.touchObject={},b.$slider.trigger("swipe",[b,"left"]);break;case"right":c=b.options.swipeToSlide?b.checkNavigable(b.currentSlide-b.getSlideCount()):b.currentSlide-b.getSlideCount(),b.slideHandler(c),b.currentDirection=1,b.touchObject={},b.$slider.trigger("swipe",[b,"right"])}else b.touchObject.startX!==b.touchObject.curX&&(b.slideHandler(b.currentSlide),b.touchObject={})},b.prototype.swipeHandler=function(a){var b=this;if(!(b.options.swipe===!1||"ontouchend"in document&&b.options.swipe===!1||b.options.draggable===!1&&-1!==a.type.indexOf("mouse")))switch(b.touchObject.fingerCount=a.originalEvent&&void 0!==a.originalEvent.touches?a.originalEvent.touches.length:1,b.touchObject.minSwipe=b.listWidth/b.options.touchThreshold,b.options.verticalSwiping===!0&&(b.touchObject.minSwipe=b.listHeight/b.options.touchThreshold),a.data.action){case"start":b.swipeStart(a);break;case"move":b.swipeMove(a);break;case"end":b.swipeEnd(a)}},b.prototype.swipeMove=function(a){var d,e,f,g,h,b=this;return h=void 0!==a.originalEvent?a.originalEvent.touches:null,!b.dragging||h&&1!==h.length?!1:(d=b.getLeft(b.currentSlide),b.touchObject.curX=void 0!==h?h[0].pageX:a.clientX,b.touchObject.curY=void 0!==h?h[0].pageY:a.clientY,b.touchObject.swipeLength=Math.round(Math.sqrt(Math.pow(b.touchObject.curX-b.touchObject.startX,2))),b.options.verticalSwiping===!0&&(b.touchObject.swipeLength=Math.round(Math.sqrt(Math.pow(b.touchObject.curY-b.touchObject.startY,2)))),e=b.swipeDirection(),"vertical"!==e?(void 0!==a.originalEvent&&b.touchObject.swipeLength>4&&a.preventDefault(),g=(b.options.rtl===!1?1:-1)*(b.touchObject.curX>b.touchObject.startX?1:-1),b.options.verticalSwiping===!0&&(g=b.touchObject.curY>b.touchObject.startY?1:-1),f=b.touchObject.swipeLength,b.touchObject.edgeHit=!1,b.options.infinite===!1&&(0===b.currentSlide&&"right"===e||b.currentSlide>=b.getDotCount()&&"left"===e)&&(f=b.touchObject.swipeLength*b.options.edgeFriction,b.touchObject.edgeHit=!0),b.options.vertical===!1?b.swipeLeft=d+f*g:b.swipeLeft=d+f*(b.$list.height()/b.listWidth)*g,b.options.verticalSwiping===!0&&(b.swipeLeft=d+f*g),b.options.fade===!0||b.options.touchMove===!1?!1:b.animating===!0?(b.swipeLeft=null,!1):void b.setCSS(b.swipeLeft)):void 0)},b.prototype.swipeStart=function(a){var c,b=this;return 1!==b.touchObject.fingerCount||b.slideCount<=b.options.slidesToShow?(b.touchObject={},!1):(void 0!==a.originalEvent&&void 0!==a.originalEvent.touches&&(c=a.originalEvent.touches[0]),b.touchObject.startX=b.touchObject.curX=void 0!==c?c.pageX:a.clientX,b.touchObject.startY=b.touchObject.curY=void 0!==c?c.pageY:a.clientY,void(b.dragging=!0))},b.prototype.unfilterSlides=b.prototype.slickUnfilter=function(){var a=this;null!==a.$slidesCache&&(a.unload(),a.$slideTrack.children(this.options.slide).detach(),a.$slidesCache.appendTo(a.$slideTrack),a.reinit())},b.prototype.unload=function(){var b=this;a(".slick-cloned",b.$slider).remove(),b.$dots&&b.$dots.remove(),b.$prevArrow&&b.htmlExpr.test(b.options.prevArrow)&&b.$prevArrow.remove(),b.$nextArrow&&b.htmlExpr.test(b.options.nextArrow)&&b.$nextArrow.remove(),b.$slides.removeClass("slick-slide slick-active slick-visible slick-current").attr("aria-hidden","true").css("width","")},b.prototype.unslick=function(a){var b=this;b.$slider.trigger("unslick",[b,a]),b.destroy()},b.prototype.updateArrows=function(){var b,a=this;b=Math.floor(a.options.slidesToShow/2),a.options.arrows===!0&&a.slideCount>a.options.slidesToShow&&!a.options.infinite&&(a.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false"),a.$nextArrow.removeClass("slick-disabled").attr("aria-disabled","false"),0===a.currentSlide?(a.$prevArrow.addClass("slick-disabled").attr("aria-disabled","true"),a.$nextArrow.removeClass("slick-disabled").attr("aria-disabled","false")):a.currentSlide>=a.slideCount-a.options.slidesToShow&&a.options.centerMode===!1?(a.$nextArrow.addClass("slick-disabled").attr("aria-disabled","true"),a.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false")):a.currentSlide>=a.slideCount-1&&a.options.centerMode===!0&&(a.$nextArrow.addClass("slick-disabled").attr("aria-disabled","true"),a.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false")))},b.prototype.updateDots=function(){var a=this;null!==a.$dots&&(a.$dots.find("li").removeClass("slick-active").attr("aria-hidden","true"),a.$dots.find("li").eq(Math.floor(a.currentSlide/a.options.slidesToScroll)).addClass("slick-active").attr("aria-hidden","false"))},b.prototype.visibility=function(){var a=this;document[a.hidden]?(a.paused=!0,a.autoPlayClear()):a.options.autoplay===!0&&(a.paused=!1,a.autoPlay())},b.prototype.initADA=function(){var b=this;b.$slides.add(b.$slideTrack.find(".slick-cloned")).attr({"aria-hidden":"true",tabindex:"-1"}).find("a, input, button, select").attr({tabindex:"-1"}),b.$slideTrack.attr("role","listbox"),b.$slides.not(b.$slideTrack.find(".slick-cloned")).each(function(c){a(this).attr({role:"option","aria-describedby":"slick-slide"+b.instanceUid+c})}),null!==b.$dots&&b.$dots.attr("role","tablist").find("li").each(function(c){a(this).attr({role:"presentation","aria-selected":"false","aria-controls":"navigation"+b.instanceUid+c,id:"slick-slide"+b.instanceUid+c})}).first().attr("aria-selected","true").end().find("button").attr("role","button").end().closest("div").attr("role","toolbar"),b.activateADA()},b.prototype.activateADA=function(){var a=this;a.$slideTrack.find(".slick-active").attr({"aria-hidden":"false"}).find("a, input, button, select").attr({tabindex:"0"})},b.prototype.focusHandler=function(){var b=this;b.$slider.on("focus.slick blur.slick","*",function(c){c.stopImmediatePropagation();var d=a(this);setTimeout(function(){b.isPlay&&(d.is(":focus")?(b.autoPlayClear(),b.paused=!0):(b.paused=!1,b.autoPlay()))},0)})},a.fn.slick=function(){var f,g,a=this,c=arguments[0],d=Array.prototype.slice.call(arguments,1),e=a.length;for(f=0;e>f;f++)if("object"==typeof c||"undefined"==typeof c?a[f].slick=new b(a[f],c):g=a[f].slick[c].apply(a[f].slick,d),"undefined"!=typeof g)return g;return a}});
  define('src/js/carousel/settings',{
    arrows: true,
    slidesToShow: 3,
    infinite: false,
    slidesToScroll: 3,
    speed: 200,
    dots: true
  });
  define('src/js/carousel/index',['require','jquery-private','underscore','slick','./settings'],function(require) {

    var $ = require('jquery-private');
    var _ = require('underscore');

    if ("undefined" === typeof jQuery.fn.slick) {
      require('slick');
    }

    var $el = $('#tvp-gallery');

     var skeleton = '<div id="tvpchg-slider" class="slick-initialized slick-slider">\
                    <div aria-live="polite" class="slick-list draggable">\
                      <div class="slick-track" style="opacity: 1; width: 3402px;">\
                        <div class="slick-slide slick-current slick-active" data-slick-index="0" aria-hidden="false" tabindex="-1" role="option" aria-describedby="slick-slide00" style="width: 243px;">\
                          <div class="tvp-video col-3">\
                            <div class="tvp-skel-overlay"></div>\
                            <div class="tvp-skel-row"></div><div class="tvp-skel-row tvp-mid"></div>\
                          </div>\
                        </div>\
                        <div class="slick-slide slick-active" data-slick-index="1" aria-hidden="false" tabindex="-1" role="option" aria-describedby="slick-slide01" style="width: 243px;">\
                          <div class="tvp-video col-3">\
                            <div class="tvp-skel-overlay"></div>\
                            <div class="tvp-skel-row"></div><div class="tvp-skel-row tvp-mid"></div>\
                          </div>\
                        </div><div class=\"slick-slide slick-active\" style=\"width: 243px;\">\
                          <div class=\"tvp-video col-3\">\
                            <div class="tvp-skel-overlay"></div>\
                            <div class="tvp-skel-row"></div><div class="tvp-skel-row tvp-mid"></div>\
                          </div>\
                        </div>\
                      </div>\
                    </div>\
                  </div>';

    $el.addClass('tvp-skel');
    //$el.html(skeleton);

    var templ = '<div><div data-tvp-video-id="<%= id %>" data-index="<%= index %>" class="tvp-video col-3"><div class="tvp-video-image" style="background-image:url(\'<%= asset.thumbnailUrl %>\'); "><div class="video-overlay"></div><div class="tvp-video-play-button"></div></div><p><span class="tittle"><%= title %></span></p></div></div>';
    var redefine = function(val){ return ("undefined" !== typeof val)};
    var name = "";
    var category = "";
    if (redefine(window.__TVPage__) && redefine(__TVPage__.config) && redefine(__TVPage__.config['tvp-gallery']) && redefine(__TVPage__.config['tvp-gallery'].attributes) && redefine(__TVPage__.config['tvp-gallery'].attributes.category)) {
      name = __TVPage__.config['tvp-gallery'].attributes.category.label;
      category = __TVPage__.config['tvp-gallery'].attributes.category.value;
    }

    $.ajax({
      url: "//app.tvpage.com/api/channels/"+_tvp.channelId+"/videos",
      dataType: 'jsonp',
      data:{
        category: category,
        "X-login-id": _tvp.lid
      }
    }).done(function(res) {

      if (res && res.length) {
       
        var videos = res.slice(0, 24);
        var html = '<div id="tvpchg-slider">';
        _tvp.channel = {videos:videos};
        for (var i = 0; i < videos.length; i++) {
          videos[i].index = i;
          html+=_.template( templ )( videos[i] );
        }
        html += "</div>";
        $el.html(html).promise().done(function() {
          var $slider = $el.addClass('ready').find('#tvpchg-slider');
          $slider.slick(require('./settings')).addClass('ready');
          $slider.find('.slick-prev').addClass('slick-arrow');
          $slider.find('.slick-next').addClass('slick-arrow');
          $slider.find('.slick-arrow').hover(function(){
            $(this).addClass('hovered');
          }, function(){
            $(this).removeClass('hovered');
          });
          if (name.length) {
            $name = $('<span/>').html(name);
            var $headline = $('<h2>/').addClass('tvp-gallery-headline').html("Watch Videos: ").append($('<span/>').html(name));
            $el.prepend($headline);
          }
        });

      } else {
        $el.addClass("tvp-hidden");
      }

    });

  });


  define('text!tmpl/light-box.html',[],function () { return '<div class="lb-content"><div class="lb-header"><button class="lb-close"></button><a id="watch_more_link" href="https://www.bedbathandbeyond.tv/" target="_blank" class="watch-more-tvp"><span>Watch On <span>Bed Bath & Beyond TV</span></span></a></div><div class="lb-body"></div><h4 class="lb-title"></h4></div><div id="lb-overlay" class="lb-overlay"></div>';});

  define('src/js/light-box/index',['require','underscore','jquery-private','../jquery.pubsub-loader','../../../text!tmpl/light-box.html'],function(require) {

    var _ = require("underscore");
    var $ = require("jquery-private");

    require('../jquery.pubsub-loader');

    var $el = null;

    function show(){
      $el.find('.lb-overlay').show();
      $el.removeClass('off');
    }

    function hide(){
      $el.find('.lb-overlay').hide();
      $el.addClass('off');
      $.publish('light-box:hiding');
    }

    function changeTitle(e,video){
      if(_tvp.channel && video){
        $el.find('.lb-title').html(video.title);
        var link = "https://www.bedbathandbeyond.tv/"
        $el.find('#watch_more_link').attr('href',link);
        $el.find('#watch_more_link_mobile').attr('href',link);
      }
    }

    return {
      init: function(callback){

        $el = $('<div/>').attr('id','tvplb').addClass('off');
        var html = require('../../../text!tmpl/light-box.html');
        $el.append(_.template(html)({logo: _tvp.assetsBaseUrl +'/script-lbp/assets/logo.png'}));
        $el.appendTo('body');

        $el.on('click', '.lb-close', hide);
        $el.on('click', '.lb-overlay', hide);

        $.subscribe('light-box:show', show);
        $.subscribe('player:play-video',changeTitle);

        if (_.isFunction(callback)) {
          callback();
        }

      }
    };

  });

  define('text!tmpl/player.html',[],function () { return '<div id="tvpp">\n\t<div class="tvpp-wrapper">\n\t\t<div id="tvpp-holder" class="tvpp-holder"></div>\n\t</div>\n</div>';});

  define('src/js/player/settings',{
    divId: 'tvpp-holder',
    controls: {
      active: true,
      seekBar: { progressColor: '#273691' },
      floater: { removeControls: ['tvplogo', 'hd'], transcript: true }
    },
    poster: true,
    techOrder: 'html5,flash',
    analytics: { tvpa: true },
    apiBaseUrl: '//app.tvpage.com',
    apiTranscript: 'https://app.tvpage.com/api/videos/transcript',
    jsLib: '//d2kmhr1caomykv.cloudfront.net/player/assets/tvp/tvp-1.8.3-min.js',
    swf: "//d2kmhr1caomykv.cloudfront.net/player/assets/tvp/tvp-1.8.3-flash.swf"
  });

  define('src/js/player/index',['require','jquery-private','../jquery.pubsub-loader','text!tmpl/player.html','./settings'],function(require) {

    var $ = require('jquery-private');

    require('../jquery.pubsub-loader');

    var iOSsmall = /iPhone|iPod/i.test(navigator.userAgent),
      mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      $el = null,
      options = null,
      assetsList = null,
      playerReady = null,
      player = null,
      index = null,
      multiple = true,
      keys = null,
      isFullScreen = false;

    function resize() {
      if (player && $el.length && !isFullScreen) {
        player.resize($el.width(), $el.height());
      }
    }

    function putButtonOverlay() {
      $('<div/>').attr('id', 'tvpp-play').insertAfter('#tvpp-holder').on('click', function() {
        $el.find('.video-overlay').hide();
        $(this).off().remove();
        return player ? player.play() : false;
      });
    }

    function play(asset) {
      if (asset) {
        if (asset.type === 'mp4' && iOSsmall) {
          $el.addClass('tvp-controls-mp4');
          $el.find('#ControlBarFloater').parent().addClass('tvp-hide-mp4');
        } else {
          $el.removeClass('tvp-controls-mp4');
          $el.find('#ControlBarFloater').parent().removeClass('tvp-hide-mp4');
        }
        var checks = 0;
        (function readyPoller( ){
          var deferred = setTimeout(function(){
            if (!playerReady) {
              if ( ++checks < 25 ) {
                readyPoller();
              }
            } else {
              if (mobile) {
                player.cueVideo(asset);
                if (!iOSsmall && asset.type == 'mp4') putButtonOverlay();
              } else {
                player.loadVideo(asset);
              }
            }
          }, 200);
        })();
      }
    }

    function extractAsset(video) {
      if (video && video.asset) {
        var asset = video.asset;
        asset.analyticsObj = { vd: video.id, li: video.loginId, pg: video.parentId ? video.parentId : 0 };
        if (!asset.sources) asset.sources = [{ file: asset.videoId }];
        asset.type = asset.type || 'youtube';
        return asset;
      }
    }

    function handleEnded() {
      if (multiple) {
        index = (index == assetsList.length - 1) ? 0 : index + 1;
        if (mobile) {
          player.cueVideo(asset);
          if (!iOSsmall && assetsList[index].type == 'mp4') putButtonOverlay();
        } else {
          player.loadVideo(extractAsset(assetsList[index]));
        }
        $.publish('player:play-video', assetsList[index]);
      }
    }

    function startAnalytics () {
      $.ajax({ dataType: 'script', cache: true, url:"//a.tvpage.com/tvpa.min.js" })
      .done(function() {
      
        var checks = 0;
        (function analyticsPoller( ){
           var deferred = setTimeout(function(){
              if ( "undefined" === typeof window._tvpa ) {
                if ( ++checks < 10 ) {
                  analyticsPoller();
                } else {
                  console.log("analytics didn't load");
                }
              } else {
                _tvpa.push(["config", { li:_tvp.lid, gaDomain:"embed.bedbathandbeyond.com", "logUrl": "\/\/api.tvpage.com\/v1\/__tvpa.gif"}]);
                _tvpa.push(["track","ci",{ li:_tvp.lid}]);
              }
           }, 200);
        })();

      });
      
    }

    return {
      init: function(opts, callback) {

        options = opts || {};

        startAnalytics();

        var html = require('text!tmpl/player.html');
        $el = $(html).appendTo(opts.place);

        var settings = require('./settings');
        var ready = function(p) {
          player = TVPage.instances[p.options.globalRunId];
          player.on('tvp:media:videoended', handleEnded);
          var whited = false;
          player.on('tvp:media:videoplaying', function(){
            if (!whited) {
              $('#tvpp').css('backgroundColor', 'transparent');
              whited = true;
            }
          });
          player.on('tvp:media:ready', function(){
            playerReady = true;
            if ($.isFunction(callback)) {
              callback();
            }
          });
          if ("undefined" !== typeof window.BigScreen) {
            BigScreen.onchange = function(){
              isFullScreen = !isFullScreen;
            };
          }
          resize();
        };

        if (!window.TVPage) {
          $.ajax({ dataType: 'script', cache: true, url: settings.jsLib })
            .done(function() {
              if (window.TVPage) {
                ready(new TVPage.player(settings));
              }
            });
        } else {
          ready(new TVPage.player(settings));
        }

        $.subscribe('products:loaded', function(e, products) {
          products.length ? $el.removeClass('no-products') : $el.addClass('no-products');
          resize();
        });

        $.subscribe('light-box:hiding', function() {
          $el.removeClass('no-products');
          $el.find('#tvpp-play').remove();
          player.stop();
        });

        $.subscribe('player:play', function(e, n, video) {
          resize();
          $el.find('.video-overlay').hide();
          index = parseInt(n);
          assetsList = _tvp.channel.videos;
          multiple = true;

          var video = assetsList[index];
          if (video) {
            play(extractAsset(video));
            $.publish('player:play-video', video);
          }

        });

        $(window).resize(resize);
      }
    };

  });

  /*! iScroll v5.2.0 ~ (c) 2008-2016 Matteo Spinelli ~ http://cubiq.org/license */
  (function (window, document, Math) {
    var rAF = window.requestAnimationFrame  ||
      window.webkitRequestAnimationFrame  ||
      window.mozRequestAnimationFrame     ||
      window.oRequestAnimationFrame       ||
      window.msRequestAnimationFrame      ||
      function (callback) { window.setTimeout(callback, 1000 / 60); };

    var utils = (function () {
      var me = {};

      var _elementStyle = document.createElement('div').style;
      var _vendor = (function () {
        var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
          transform,
          i = 0,
          l = vendors.length;

        for ( ; i < l; i++ ) {
          transform = vendors[i] + 'ransform';
          if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
        }

        return false;
      })();

      function _prefixStyle (style) {
        if ( _vendor === false ) return false;
        if ( _vendor === '' ) return style;
        return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
      }

      me.getTime = Date.now || function getTime () { return new Date().getTime(); };

      me.extend = function (target, obj) {
        for ( var i in obj ) {
          target[i] = obj[i];
        }
      };

      me.addEvent = function (el, type, fn, capture) {
        el.addEventListener(type, fn, !!capture);
      };

      me.removeEvent = function (el, type, fn, capture) {
        el.removeEventListener(type, fn, !!capture);
      };

      me.prefixPointerEvent = function (pointerEvent) {
        return window.MSPointerEvent ?
        'MSPointer' + pointerEvent.charAt(7).toUpperCase() + pointerEvent.substr(8):
          pointerEvent;
      };

      me.momentum = function (current, start, time, lowerMargin, wrapperSize, deceleration) {
        var distance = current - start,
          speed = Math.abs(distance) / time,
          destination,
          duration;

        deceleration = deceleration === undefined ? 0.0006 : deceleration;

        destination = current + ( speed * speed ) / ( 2 * deceleration ) * ( distance < 0 ? -1 : 1 );
        duration = speed / deceleration;

        if ( destination < lowerMargin ) {
          destination = wrapperSize ? lowerMargin - ( wrapperSize / 2.5 * ( speed / 8 ) ) : lowerMargin;
          distance = Math.abs(destination - current);
          duration = distance / speed;
        } else if ( destination > 0 ) {
          destination = wrapperSize ? wrapperSize / 2.5 * ( speed / 8 ) : 0;
          distance = Math.abs(current) + destination;
          duration = distance / speed;
        }

        return {
          destination: Math.round(destination),
          duration: duration
        };
      };

      var _transform = _prefixStyle('transform');

      me.extend(me, {
        hasTransform: _transform !== false,
        hasPerspective: _prefixStyle('perspective') in _elementStyle,
        hasTouch: 'ontouchstart' in window,
        hasPointer: !!(window.PointerEvent || window.MSPointerEvent), // IE10 is prefixed
        hasTransition: _prefixStyle('transition') in _elementStyle
      });

      /*
       This should find all Android browsers lower than build 535.19 (both stock browser and webview)
       - galaxy S2 is ok
       - 2.3.6 : `AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1`
       - 4.0.4 : `AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30`
       - galaxy S3 is badAndroid (stock brower, webview)
       `AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30`
       - galaxy S4 is badAndroid (stock brower, webview)
       `AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30`
       - galaxy S5 is OK
       `AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36 (Chrome/)`
       - galaxy S6 is OK
       `AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36 (Chrome/)`
       */
      me.isBadAndroid = (function() {
        var appVersion = window.navigator.appVersion;
        // Android browser is not a chrome browser.
        if (/Android/.test(appVersion) && !(/Chrome\/\d/.test(appVersion))) {
          var safariVersion = appVersion.match(/Safari\/(\d+.\d)/);
          if(safariVersion && typeof safariVersion === "object" && safariVersion.length >= 2) {
            return parseFloat(safariVersion[1]) < 535.19;
          } else {
            return true;
          }
        } else {
          return false;
        }
      })();

      me.extend(me.style = {}, {
        transform: _transform,
        transitionTimingFunction: _prefixStyle('transitionTimingFunction'),
        transitionDuration: _prefixStyle('transitionDuration'),
        transitionDelay: _prefixStyle('transitionDelay'),
        transformOrigin: _prefixStyle('transformOrigin')
      });

      me.hasClass = function (e, c) {
        var re = new RegExp("(^|\\s)" + c + "(\\s|$)");
        return re.test(e.className);
      };

      me.addClass = function (e, c) {
        if ( me.hasClass(e, c) ) {
          return;
        }

        var newclass = e.className.split(' ');
        newclass.push(c);
        e.className = newclass.join(' ');
      };

      me.removeClass = function (e, c) {
        if ( !me.hasClass(e, c) ) {
          return;
        }

        var re = new RegExp("(^|\\s)" + c + "(\\s|$)", 'g');
        e.className = e.className.replace(re, ' ');
      };

      me.offset = function (el) {
        var left = -el.offsetLeft,
          top = -el.offsetTop;

        // jshint -W084
        while (el = el.offsetParent) {
          left -= el.offsetLeft;
          top -= el.offsetTop;
        }
        // jshint +W084

        return {
          left: left,
          top: top
        };
      };

      me.preventDefaultException = function (el, exceptions) {
        for ( var i in exceptions ) {
          if ( exceptions[i].test(el[i]) ) {
            return true;
          }
        }

        return false;
      };

      me.extend(me.eventType = {}, {
        touchstart: 1,
        touchmove: 1,
        touchend: 1,

        mousedown: 2,
        mousemove: 2,
        mouseup: 2,

        pointerdown: 3,
        pointermove: 3,
        pointerup: 3,

        MSPointerDown: 3,
        MSPointerMove: 3,
        MSPointerUp: 3
      });

      me.extend(me.ease = {}, {
        quadratic: {
          style: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          fn: function (k) {
            return k * ( 2 - k );
          }
        },
        circular: {
          style: 'cubic-bezier(0.1, 0.57, 0.1, 1)',   // Not properly "circular" but this looks better, it should be (0.075, 0.82, 0.165, 1)
          fn: function (k) {
            return Math.sqrt( 1 - ( --k * k ) );
          }
        },
        back: {
          style: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          fn: function (k) {
            var b = 4;
            return ( k = k - 1 ) * k * ( ( b + 1 ) * k + b ) + 1;
          }
        },
        bounce: {
          style: '',
          fn: function (k) {
            if ( ( k /= 1 ) < ( 1 / 2.75 ) ) {
              return 7.5625 * k * k;
            } else if ( k < ( 2 / 2.75 ) ) {
              return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;
            } else if ( k < ( 2.5 / 2.75 ) ) {
              return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;
            } else {
              return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;
            }
          }
        },
        elastic: {
          style: '',
          fn: function (k) {
            var f = 0.22,
              e = 0.4;

            if ( k === 0 ) { return 0; }
            if ( k == 1 ) { return 1; }

            return ( e * Math.pow( 2, - 10 * k ) * Math.sin( ( k - f / 4 ) * ( 2 * Math.PI ) / f ) + 1 );
          }
        }
      });

      me.tap = function (e, eventName) {
        var ev = document.createEvent('Event');
        ev.initEvent(eventName, true, true);
        ev.pageX = e.pageX;
        ev.pageY = e.pageY;
        e.target.dispatchEvent(ev);
      };

      me.click = function (e) {
        var target = e.target,
          ev;

        if ( !(/(SELECT|INPUT|TEXTAREA)/i).test(target.tagName) ) {
          // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/initMouseEvent
          // initMouseEvent is deprecated.
          ev = document.createEvent(window.MouseEvent ? 'MouseEvents' : 'Event');
          ev.initEvent('click', true, true);
          ev.view = e.view || window;
          ev.detail = 1;
          ev.screenX = target.screenX || 0;
          ev.screenY = target.screenY || 0;
          ev.clientX = target.clientX || 0;
          ev.clientY = target.clientY || 0;
          ev.ctrlKey = !!e.ctrlKey;
          ev.altKey = !!e.altKey;
          ev.shiftKey = !!e.shiftKey;
          ev.metaKey = !!e.metaKey;
          ev.button = 0;
          ev.relatedTarget = null;
          ev._constructed = true;
          target.dispatchEvent(ev);
        }
      };

      return me;
    })();
    function IScroll (el, options) {
      this.wrapper = typeof el == 'string' ? document.querySelector(el) : el;
      this.scroller = this.wrapper.children[0];
      this.scrollerStyle = this.scroller.style;       // cache style for better performance

      this.options = {

        resizeScrollbars: true,

        mouseWheelSpeed: 20,

        snapThreshold: 0.334,

// INSERT POINT: OPTIONS
        disablePointer : !utils.hasPointer,
        disableTouch : utils.hasPointer || !utils.hasTouch,
        disableMouse : utils.hasPointer || utils.hasTouch,
        startX: 0,
        startY: 0,
        scrollY: true,
        directionLockThreshold: 5,
        momentum: true,

        bounce: true,
        bounceTime: 600,
        bounceEasing: '',

        preventDefault: true,
        preventDefaultException: { tagName: /^(INPUT|TEXTAREA|BUTTON|SELECT)$/ },

        HWCompositing: true,
        useTransition: true,
        useTransform: true,
        bindToWrapper: typeof window.onmousedown === "undefined"
      };

      for ( var i in options ) {
        this.options[i] = options[i];
      }

      // Normalize options
      this.translateZ = this.options.HWCompositing && utils.hasPerspective ? ' translateZ(0)' : '';

      this.options.useTransition = utils.hasTransition && this.options.useTransition;
      this.options.useTransform = utils.hasTransform && this.options.useTransform;

      this.options.eventPassthrough = this.options.eventPassthrough === true ? 'vertical' : this.options.eventPassthrough;
      this.options.preventDefault = !this.options.eventPassthrough && this.options.preventDefault;

      // If you want eventPassthrough I have to lock one of the axes
      this.options.scrollY = this.options.eventPassthrough == 'vertical' ? false : this.options.scrollY;
      this.options.scrollX = this.options.eventPassthrough == 'horizontal' ? false : this.options.scrollX;

      // With eventPassthrough we also need lockDirection mechanism
      this.options.freeScroll = this.options.freeScroll && !this.options.eventPassthrough;
      this.options.directionLockThreshold = this.options.eventPassthrough ? 0 : this.options.directionLockThreshold;

      this.options.bounceEasing = typeof this.options.bounceEasing == 'string' ? utils.ease[this.options.bounceEasing] || utils.ease.circular : this.options.bounceEasing;

      this.options.resizePolling = this.options.resizePolling === undefined ? 60 : this.options.resizePolling;

      if ( this.options.tap === true ) {
        this.options.tap = 'tap';
      }

      // https://github.com/cubiq/iscroll/issues/1029
      if (!this.options.useTransition && !this.options.useTransform) {
        if(!(/relative|absolute/i).test(this.scrollerStyle.position)) {
          this.scrollerStyle.position = "relative";
        }
      }

      if ( this.options.shrinkScrollbars == 'scale' ) {
        this.options.useTransition = false;
      }

      this.options.invertWheelDirection = this.options.invertWheelDirection ? -1 : 1;

// INSERT POINT: NORMALIZATION

      // Some defaults
      this.x = 0;
      this.y = 0;
      this.directionX = 0;
      this.directionY = 0;
      this._events = {};

// INSERT POINT: DEFAULTS

      this._init();
      this.refresh();

      this.scrollTo(this.options.startX, this.options.startY);
      this.enable();
    }

    IScroll.prototype = {
      version: '5.2.0',

      _init: function () {
        this._initEvents();

        if ( this.options.scrollbars || this.options.indicators ) {
          this._initIndicators();
        }

        if ( this.options.mouseWheel ) {
          this._initWheel();
        }

        if ( this.options.snap ) {
          this._initSnap();
        }

        if ( this.options.keyBindings ) {
          this._initKeys();
        }

// INSERT POINT: _init

      },

      destroy: function () {
        this._initEvents(true);
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = null;
        this._execEvent('destroy');
      },

      _transitionEnd: function (e) {
        if ( e.target != this.scroller || !this.isInTransition ) {
          return;
        }

        this._transitionTime();
        if ( !this.resetPosition(this.options.bounceTime) ) {
          this.isInTransition = false;
          this._execEvent('scrollEnd');
        }
      },

      _start: function (e) {
        // React to left mouse button only
        if ( utils.eventType[e.type] != 1 ) {
          // for button property
          // http://unixpapa.com/js/mouse.html
          var button;
          if (!e.which) {
            /* IE case */
            button = (e.button < 2) ? 0 :
              ((e.button == 4) ? 1 : 2);
          } else {
            /* All others */
            button = e.button;
          }
          if ( button !== 0 ) {
            return;
          }
        }

        if ( !this.enabled || (this.initiated && utils.eventType[e.type] !== this.initiated) ) {
          return;
        }

        if ( this.options.preventDefault && !utils.isBadAndroid && !utils.preventDefaultException(e.target, this.options.preventDefaultException) ) {
          e.preventDefault();
        }

        var point = e.touches ? e.touches[0] : e,
          pos;

        this.initiated  = utils.eventType[e.type];
        this.moved      = false;
        this.distX      = 0;
        this.distY      = 0;
        this.directionX = 0;
        this.directionY = 0;
        this.directionLocked = 0;

        this.startTime = utils.getTime();

        if ( this.options.useTransition && this.isInTransition ) {
          this._transitionTime();
          this.isInTransition = false;
          pos = this.getComputedPosition();
          this._translate(Math.round(pos.x), Math.round(pos.y));
          this._execEvent('scrollEnd');
        } else if ( !this.options.useTransition && this.isAnimating ) {
          this.isAnimating = false;
          this._execEvent('scrollEnd');
        }

        this.startX    = this.x;
        this.startY    = this.y;
        this.absStartX = this.x;
        this.absStartY = this.y;
        this.pointX    = point.pageX;
        this.pointY    = point.pageY;

        this._execEvent('beforeScrollStart');
      },

      _move: function (e) {
        if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
          return;
        }

        if ( this.options.preventDefault ) {    // increases performance on Android? TODO: check!
          e.preventDefault();
        }

        var point       = e.touches ? e.touches[0] : e,
          deltaX      = point.pageX - this.pointX,
          deltaY      = point.pageY - this.pointY,
          timestamp   = utils.getTime(),
          newX, newY,
          absDistX, absDistY;

        this.pointX     = point.pageX;
        this.pointY     = point.pageY;

        this.distX      += deltaX;
        this.distY      += deltaY;
        absDistX        = Math.abs(this.distX);
        absDistY        = Math.abs(this.distY);

        // We need to move at least 10 pixels for the scrolling to initiate
        if ( timestamp - this.endTime > 300 && (absDistX < 10 && absDistY < 10) ) {
          return;
        }

        // If you are scrolling in one direction lock the other
        if ( !this.directionLocked && !this.options.freeScroll ) {
          if ( absDistX > absDistY + this.options.directionLockThreshold ) {
            this.directionLocked = 'h';     // lock horizontally
          } else if ( absDistY >= absDistX + this.options.directionLockThreshold ) {
            this.directionLocked = 'v';     // lock vertically
          } else {
            this.directionLocked = 'n';     // no lock
          }
        }

        if ( this.directionLocked == 'h' ) {
          if ( this.options.eventPassthrough == 'vertical' ) {
            e.preventDefault();
          } else if ( this.options.eventPassthrough == 'horizontal' ) {
            this.initiated = false;
            return;
          }

          deltaY = 0;
        } else if ( this.directionLocked == 'v' ) {
          if ( this.options.eventPassthrough == 'horizontal' ) {
            e.preventDefault();
          } else if ( this.options.eventPassthrough == 'vertical' ) {
            this.initiated = false;
            return;
          }

          deltaX = 0;
        }

        deltaX = this.hasHorizontalScroll ? deltaX : 0;
        deltaY = this.hasVerticalScroll ? deltaY : 0;

        newX = this.x + deltaX;
        newY = this.y + deltaY;

        // Slow down if outside of the boundaries
        if ( newX > 0 || newX < this.maxScrollX ) {
          newX = this.options.bounce ? this.x + deltaX / 3 : newX > 0 ? 0 : this.maxScrollX;
        }
        if ( newY > 0 || newY < this.maxScrollY ) {
          newY = this.options.bounce ? this.y + deltaY / 3 : newY > 0 ? 0 : this.maxScrollY;
        }

        this.directionX = deltaX > 0 ? -1 : deltaX < 0 ? 1 : 0;
        this.directionY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0;

        if ( !this.moved ) {
          this._execEvent('scrollStart');
        }

        this.moved = true;

        this._translate(newX, newY);

        /* REPLACE START: _move */

        if ( timestamp - this.startTime > 300 ) {
          this.startTime = timestamp;
          this.startX = this.x;
          this.startY = this.y;
        }

        /* REPLACE END: _move */

      },

      _end: function (e) {
        if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
          return;
        }

        if ( this.options.preventDefault && !utils.preventDefaultException(e.target, this.options.preventDefaultException) ) {
          e.preventDefault();
        }

        var point = e.changedTouches ? e.changedTouches[0] : e,
          momentumX,
          momentumY,
          duration = utils.getTime() - this.startTime,
          newX = Math.round(this.x),
          newY = Math.round(this.y),
          distanceX = Math.abs(newX - this.startX),
          distanceY = Math.abs(newY - this.startY),
          time = 0,
          easing = '';

        this.isInTransition = 0;
        this.initiated = 0;
        this.endTime = utils.getTime();

        // reset if we are outside of the boundaries
        if ( this.resetPosition(this.options.bounceTime) ) {
          return;
        }

        this.scrollTo(newX, newY);  // ensures that the last position is rounded

        // we scrolled less than 10 pixels
        if ( !this.moved ) {
          if ( this.options.tap ) {
            utils.tap(e, this.options.tap);
          }

          if ( this.options.click ) {
            utils.click(e);
          }

          this._execEvent('scrollCancel');
          return;
        }

        if ( this._events.flick && duration < 200 && distanceX < 100 && distanceY < 100 ) {
          this._execEvent('flick');
          return;
        }

        // start momentum animation if needed
        if ( this.options.momentum && duration < 300 ) {
          momentumX = this.hasHorizontalScroll ? utils.momentum(this.x, this.startX, duration, this.maxScrollX, this.options.bounce ? this.wrapperWidth : 0, this.options.deceleration) : { destination: newX, duration: 0 };
          momentumY = this.hasVerticalScroll ? utils.momentum(this.y, this.startY, duration, this.maxScrollY, this.options.bounce ? this.wrapperHeight : 0, this.options.deceleration) : { destination: newY, duration: 0 };
          newX = momentumX.destination;
          newY = momentumY.destination;
          time = Math.max(momentumX.duration, momentumY.duration);
          this.isInTransition = 1;
        }


        if ( this.options.snap ) {
          var snap = this._nearestSnap(newX, newY);
          this.currentPage = snap;
          time = this.options.snapSpeed || Math.max(
              Math.max(
                Math.min(Math.abs(newX - snap.x), 1000),
                Math.min(Math.abs(newY - snap.y), 1000)
              ), 300);
          newX = snap.x;
          newY = snap.y;

          this.directionX = 0;
          this.directionY = 0;
          easing = this.options.bounceEasing;
        }

// INSERT POINT: _end

        if ( newX != this.x || newY != this.y ) {
          // change easing function when scroller goes out of the boundaries
          if ( newX > 0 || newX < this.maxScrollX || newY > 0 || newY < this.maxScrollY ) {
            easing = utils.ease.quadratic;
          }

          this.scrollTo(newX, newY, time, easing);
          return;
        }

        this._execEvent('scrollEnd');
      },

      _resize: function () {
        var that = this;

        clearTimeout(this.resizeTimeout);

        this.resizeTimeout = setTimeout(function () {
          that.refresh();
        }, this.options.resizePolling);
      },

      resetPosition: function (time) {
        var x = this.x,
          y = this.y;

        time = time || 0;

        if ( !this.hasHorizontalScroll || this.x > 0 ) {
          x = 0;
        } else if ( this.x < this.maxScrollX ) {
          x = this.maxScrollX;
        }

        if ( !this.hasVerticalScroll || this.y > 0 ) {
          y = 0;
        } else if ( this.y < this.maxScrollY ) {
          y = this.maxScrollY;
        }

        if ( x == this.x && y == this.y ) {
          return false;
        }

        this.scrollTo(x, y, time, this.options.bounceEasing);

        return true;
      },

      disable: function () {
        this.enabled = false;
      },

      enable: function () {
        this.enabled = true;
      },

      refresh: function () {
        var rf = this.wrapper.offsetHeight;     // Force reflow

        this.wrapperWidth   = this.wrapper.clientWidth;
        this.wrapperHeight  = this.wrapper.clientHeight;

        /* REPLACE START: refresh */

        this.scrollerWidth  = this.scroller.offsetWidth;
        this.scrollerHeight = this.scroller.offsetHeight;

        this.maxScrollX     = this.wrapperWidth - this.scrollerWidth;
        this.maxScrollY     = this.wrapperHeight - this.scrollerHeight;

        /* REPLACE END: refresh */

        this.hasHorizontalScroll    = this.options.scrollX && this.maxScrollX < 0;
        this.hasVerticalScroll      = this.options.scrollY && this.maxScrollY < 0;

        if ( !this.hasHorizontalScroll ) {
          this.maxScrollX = 0;
          this.scrollerWidth = this.wrapperWidth;
        }

        if ( !this.hasVerticalScroll ) {
          this.maxScrollY = 0;
          this.scrollerHeight = this.wrapperHeight;
        }

        this.endTime = 0;
        this.directionX = 0;
        this.directionY = 0;

        this.wrapperOffset = utils.offset(this.wrapper);

        this._execEvent('refresh');

        this.resetPosition();

// INSERT POINT: _refresh

      },

      on: function (type, fn) {
        if ( !this._events[type] ) {
          this._events[type] = [];
        }

        this._events[type].push(fn);
      },

      off: function (type, fn) {
        if ( !this._events[type] ) {
          return;
        }

        var index = this._events[type].indexOf(fn);

        if ( index > -1 ) {
          this._events[type].splice(index, 1);
        }
      },

      _execEvent: function (type) {
        if ( !this._events[type] ) {
          return;
        }

        var i = 0,
          l = this._events[type].length;

        if ( !l ) {
          return;
        }

        for ( ; i < l; i++ ) {
          this._events[type][i].apply(this, [].slice.call(arguments, 1));
        }
      },

      scrollBy: function (x, y, time, easing) {
        x = this.x + x;
        y = this.y + y;
        time = time || 0;

        this.scrollTo(x, y, time, easing);
      },

      scrollTo: function (x, y, time, easing) {
        easing = easing || utils.ease.circular;

        this.isInTransition = this.options.useTransition && time > 0;
        var transitionType = this.options.useTransition && easing.style;
        if ( !time || transitionType ) {
          if(transitionType) {
            this._transitionTimingFunction(easing.style);
            this._transitionTime(time);
          }
          this._translate(x, y);
        } else {
          this._animate(x, y, time, easing.fn);
        }
      },

      scrollToElement: function (el, time, offsetX, offsetY, easing) {
        el = el.nodeType ? el : this.scroller.querySelector(el);

        if ( !el ) {
          return;
        }

        var pos = utils.offset(el);

        pos.left -= this.wrapperOffset.left;
        pos.top  -= this.wrapperOffset.top;

        // if offsetX/Y are true we center the element to the screen
        if ( offsetX === true ) {
          offsetX = Math.round(el.offsetWidth / 2 - this.wrapper.offsetWidth / 2);
        }
        if ( offsetY === true ) {
          offsetY = Math.round(el.offsetHeight / 2 - this.wrapper.offsetHeight / 2);
        }

        pos.left -= offsetX || 0;
        pos.top  -= offsetY || 0;

        pos.left = pos.left > 0 ? 0 : pos.left < this.maxScrollX ? this.maxScrollX : pos.left;
        pos.top  = pos.top  > 0 ? 0 : pos.top  < this.maxScrollY ? this.maxScrollY : pos.top;

        time = time === undefined || time === null || time === 'auto' ? Math.max(Math.abs(this.x-pos.left), Math.abs(this.y-pos.top)) : time;

        this.scrollTo(pos.left, pos.top, time, easing);
      },

      _transitionTime: function (time) {
        if (!this.options.useTransition) {
          return;
        }
        time = time || 0;
        var durationProp = utils.style.transitionDuration;
        if(!durationProp) {
          return;
        }

        this.scrollerStyle[durationProp] = time + 'ms';

        if ( !time && utils.isBadAndroid ) {
          this.scrollerStyle[durationProp] = '0.0001ms';
          // remove 0.0001ms
          var self = this;
          rAF(function() {
            if(self.scrollerStyle[durationProp] === '0.0001ms') {
              self.scrollerStyle[durationProp] = '0s';
            }
          });
        }


        if ( this.indicators ) {
          for ( var i = this.indicators.length; i--; ) {
            this.indicators[i].transitionTime(time);
          }
        }


// INSERT POINT: _transitionTime

      },

      _transitionTimingFunction: function (easing) {
        this.scrollerStyle[utils.style.transitionTimingFunction] = easing;


        if ( this.indicators ) {
          for ( var i = this.indicators.length; i--; ) {
            this.indicators[i].transitionTimingFunction(easing);
          }
        }


// INSERT POINT: _transitionTimingFunction

      },

      _translate: function (x, y) {
        if ( this.options.useTransform ) {

          /* REPLACE START: _translate */

          this.scrollerStyle[utils.style.transform] = 'translate(' + x + 'px,' + y + 'px)' + this.translateZ;

          /* REPLACE END: _translate */

        } else {
          x = Math.round(x);
          y = Math.round(y);
          this.scrollerStyle.left = x + 'px';
          this.scrollerStyle.top = y + 'px';
        }

        this.x = x;
        this.y = y;


        if ( this.indicators ) {
          for ( var i = this.indicators.length; i--; ) {
            this.indicators[i].updatePosition();
          }
        }


// INSERT POINT: _translate

      },

      _initEvents: function (remove) {
        var eventType = remove ? utils.removeEvent : utils.addEvent,
          target = this.options.bindToWrapper ? this.wrapper : window;

        eventType(window, 'orientationchange', this);
        eventType(window, 'resize', this);

        if ( this.options.click ) {
          eventType(this.wrapper, 'click', this, true);
        }

        if ( !this.options.disableMouse ) {
          eventType(this.wrapper, 'mousedown', this);
          eventType(target, 'mousemove', this);
          eventType(target, 'mousecancel', this);
          eventType(target, 'mouseup', this);
        }

        if ( utils.hasPointer && !this.options.disablePointer ) {
          eventType(this.wrapper, utils.prefixPointerEvent('pointerdown'), this);
          eventType(target, utils.prefixPointerEvent('pointermove'), this);
          eventType(target, utils.prefixPointerEvent('pointercancel'), this);
          eventType(target, utils.prefixPointerEvent('pointerup'), this);
        }

        if ( utils.hasTouch && !this.options.disableTouch ) {
          eventType(this.wrapper, 'touchstart', this);
          eventType(target, 'touchmove', this);
          eventType(target, 'touchcancel', this);
          eventType(target, 'touchend', this);
        }

        eventType(this.scroller, 'transitionend', this);
        eventType(this.scroller, 'webkitTransitionEnd', this);
        eventType(this.scroller, 'oTransitionEnd', this);
        eventType(this.scroller, 'MSTransitionEnd', this);
      },

      getComputedPosition: function () {
        var matrix = window.getComputedStyle(this.scroller, null),
          x, y;

        if ( this.options.useTransform ) {
          matrix = matrix[utils.style.transform].split(')')[0].split(', ');
          x = +(matrix[12] || matrix[4]);
          y = +(matrix[13] || matrix[5]);
        } else {
          x = +matrix.left.replace(/[^-\d.]/g, '');
          y = +matrix.top.replace(/[^-\d.]/g, '');
        }

        return { x: x, y: y };
      },
      _initIndicators: function () {
        var interactive = this.options.interactiveScrollbars,
          customStyle = typeof this.options.scrollbars != 'string',
          indicators = [],
          indicator;

        var that = this;

        this.indicators = [];

        if ( this.options.scrollbars ) {
          // Vertical scrollbar
          if ( this.options.scrollY ) {
            indicator = {
              el: createDefaultScrollbar('v', interactive, this.options.scrollbars),
              interactive: interactive,
              defaultScrollbars: true,
              customStyle: customStyle,
              resize: this.options.resizeScrollbars,
              shrink: this.options.shrinkScrollbars,
              fade: this.options.fadeScrollbars,
              listenX: false
            };

            this.wrapper.appendChild(indicator.el);
            indicators.push(indicator);
          }

          // Horizontal scrollbar
          if ( this.options.scrollX ) {
            indicator = {
              el: createDefaultScrollbar('h', interactive, this.options.scrollbars),
              interactive: interactive,
              defaultScrollbars: true,
              customStyle: customStyle,
              resize: this.options.resizeScrollbars,
              shrink: this.options.shrinkScrollbars,
              fade: this.options.fadeScrollbars,
              listenY: false
            };

            this.wrapper.appendChild(indicator.el);
            indicators.push(indicator);
          }
        }

        if ( this.options.indicators ) {
          // TODO: check concat compatibility
          indicators = indicators.concat(this.options.indicators);
        }

        for ( var i = indicators.length; i--; ) {
          this.indicators.push( new Indicator(this, indicators[i]) );
        }

        // TODO: check if we can use array.map (wide compatibility and performance issues)
        function _indicatorsMap (fn) {
          if (that.indicators) {
            for ( var i = that.indicators.length; i--; ) {
              fn.call(that.indicators[i]);
            }
          }
        }

        if ( this.options.fadeScrollbars ) {
          this.on('scrollEnd', function () {
            _indicatorsMap(function () {
              this.fade();
            });
          });

          this.on('scrollCancel', function () {
            _indicatorsMap(function () {
              this.fade();
            });
          });

          this.on('scrollStart', function () {
            _indicatorsMap(function () {
              this.fade(1);
            });
          });

          this.on('beforeScrollStart', function () {
            _indicatorsMap(function () {
              this.fade(1, true);
            });
          });
        }


        this.on('refresh', function () {
          _indicatorsMap(function () {
            this.refresh();
          });
        });

        this.on('destroy', function () {
          _indicatorsMap(function () {
            this.destroy();
          });

          delete this.indicators;
        });
      },

      _initWheel: function () {
        utils.addEvent(this.wrapper, 'wheel', this);
        utils.addEvent(this.wrapper, 'mousewheel', this);
        utils.addEvent(this.wrapper, 'DOMMouseScroll', this);

        this.on('destroy', function () {
          clearTimeout(this.wheelTimeout);
          this.wheelTimeout = null;
          utils.removeEvent(this.wrapper, 'wheel', this);
          utils.removeEvent(this.wrapper, 'mousewheel', this);
          utils.removeEvent(this.wrapper, 'DOMMouseScroll', this);
        });
      },

      _wheel: function (e) {
        if ( !this.enabled ) {
          return;
        }

        e.preventDefault();

        var wheelDeltaX, wheelDeltaY,
          newX, newY,
          that = this;

        if ( this.wheelTimeout === undefined ) {
          that._execEvent('scrollStart');
        }

        // Execute the scrollEnd event after 400ms the wheel stopped scrolling
        clearTimeout(this.wheelTimeout);
        this.wheelTimeout = setTimeout(function () {
          if(!that.options.snap) {
            that._execEvent('scrollEnd');
          }
          that.wheelTimeout = undefined;
        }, 400);

        if ( 'deltaX' in e ) {
          if (e.deltaMode === 1) {
            wheelDeltaX = -e.deltaX * this.options.mouseWheelSpeed;
            wheelDeltaY = -e.deltaY * this.options.mouseWheelSpeed;
          } else {
            wheelDeltaX = -e.deltaX;
            wheelDeltaY = -e.deltaY;
          }
        } else if ( 'wheelDeltaX' in e ) {
          wheelDeltaX = e.wheelDeltaX / 120 * this.options.mouseWheelSpeed;
          wheelDeltaY = e.wheelDeltaY / 120 * this.options.mouseWheelSpeed;
        } else if ( 'wheelDelta' in e ) {
          wheelDeltaX = wheelDeltaY = e.wheelDelta / 120 * this.options.mouseWheelSpeed;
        } else if ( 'detail' in e ) {
          wheelDeltaX = wheelDeltaY = -e.detail / 3 * this.options.mouseWheelSpeed;
        } else {
          return;
        }

        wheelDeltaX *= this.options.invertWheelDirection;
        wheelDeltaY *= this.options.invertWheelDirection;

        if ( !this.hasVerticalScroll ) {
          wheelDeltaX = wheelDeltaY;
          wheelDeltaY = 0;
        }

        if ( this.options.snap ) {
          newX = this.currentPage.pageX;
          newY = this.currentPage.pageY;

          if ( wheelDeltaX > 0 ) {
            newX--;
          } else if ( wheelDeltaX < 0 ) {
            newX++;
          }

          if ( wheelDeltaY > 0 ) {
            newY--;
          } else if ( wheelDeltaY < 0 ) {
            newY++;
          }

          this.goToPage(newX, newY);

          return;
        }

        newX = this.x + Math.round(this.hasHorizontalScroll ? wheelDeltaX : 0);
        newY = this.y + Math.round(this.hasVerticalScroll ? wheelDeltaY : 0);

        this.directionX = wheelDeltaX > 0 ? -1 : wheelDeltaX < 0 ? 1 : 0;
        this.directionY = wheelDeltaY > 0 ? -1 : wheelDeltaY < 0 ? 1 : 0;

        if ( newX > 0 ) {
          newX = 0;
        } else if ( newX < this.maxScrollX ) {
          newX = this.maxScrollX;
        }

        if ( newY > 0 ) {
          newY = 0;
        } else if ( newY < this.maxScrollY ) {
          newY = this.maxScrollY;
        }

        this.scrollTo(newX, newY, 0);

// INSERT POINT: _wheel
      },

      _initSnap: function () {
        this.currentPage = {};

        if ( typeof this.options.snap == 'string' ) {
          this.options.snap = this.scroller.querySelectorAll(this.options.snap);
        }

        this.on('refresh', function () {
          var i = 0, l,
            m = 0, n,
            cx, cy,
            x = 0, y,
            stepX = this.options.snapStepX || this.wrapperWidth,
            stepY = this.options.snapStepY || this.wrapperHeight,
            el;

          this.pages = [];

          if ( !this.wrapperWidth || !this.wrapperHeight || !this.scrollerWidth || !this.scrollerHeight ) {
            return;
          }

          if ( this.options.snap === true ) {
            cx = Math.round( stepX / 2 );
            cy = Math.round( stepY / 2 );

            while ( x > -this.scrollerWidth ) {
              this.pages[i] = [];
              l = 0;
              y = 0;

              while ( y > -this.scrollerHeight ) {
                this.pages[i][l] = {
                  x: Math.max(x, this.maxScrollX),
                  y: Math.max(y, this.maxScrollY),
                  width: stepX,
                  height: stepY,
                  cx: x - cx,
                  cy: y - cy
                };

                y -= stepY;
                l++;
              }

              x -= stepX;
              i++;
            }
          } else {
            el = this.options.snap;
            l = el.length;
            n = -1;

            for ( ; i < l; i++ ) {
              if ( i === 0 || el[i].offsetLeft <= el[i-1].offsetLeft ) {
                m = 0;
                n++;
              }

              if ( !this.pages[m] ) {
                this.pages[m] = [];
              }

              x = Math.max(-el[i].offsetLeft, this.maxScrollX);
              y = Math.max(-el[i].offsetTop, this.maxScrollY);
              cx = x - Math.round(el[i].offsetWidth / 2);
              cy = y - Math.round(el[i].offsetHeight / 2);

              this.pages[m][n] = {
                x: x,
                y: y,
                width: el[i].offsetWidth,
                height: el[i].offsetHeight,
                cx: cx,
                cy: cy
              };

              if ( x > this.maxScrollX ) {
                m++;
              }
            }
          }

          this.goToPage(this.currentPage.pageX || 0, this.currentPage.pageY || 0, 0);

          // Update snap threshold if needed
          if ( this.options.snapThreshold % 1 === 0 ) {
            this.snapThresholdX = this.options.snapThreshold;
            this.snapThresholdY = this.options.snapThreshold;
          } else {
            this.snapThresholdX = Math.round(this.pages[this.currentPage.pageX][this.currentPage.pageY].width * this.options.snapThreshold);
            this.snapThresholdY = Math.round(this.pages[this.currentPage.pageX][this.currentPage.pageY].height * this.options.snapThreshold);
          }
        });

        this.on('flick', function () {
          var time = this.options.snapSpeed || Math.max(
              Math.max(
                Math.min(Math.abs(this.x - this.startX), 1000),
                Math.min(Math.abs(this.y - this.startY), 1000)
              ), 300);

          this.goToPage(
            this.currentPage.pageX + this.directionX,
            this.currentPage.pageY + this.directionY,
            time
          );
        });
      },

      _nearestSnap: function (x, y) {
        if ( !this.pages.length ) {
          return { x: 0, y: 0, pageX: 0, pageY: 0 };
        }

        var i = 0,
          l = this.pages.length,
          m = 0;

        // Check if we exceeded the snap threshold
        if ( Math.abs(x - this.absStartX) < this.snapThresholdX &&
          Math.abs(y - this.absStartY) < this.snapThresholdY ) {
          return this.currentPage;
        }

        if ( x > 0 ) {
          x = 0;
        } else if ( x < this.maxScrollX ) {
          x = this.maxScrollX;
        }

        if ( y > 0 ) {
          y = 0;
        } else if ( y < this.maxScrollY ) {
          y = this.maxScrollY;
        }

        for ( ; i < l; i++ ) {
          if ( x >= this.pages[i][0].cx ) {
            x = this.pages[i][0].x;
            break;
          }
        }

        l = this.pages[i].length;

        for ( ; m < l; m++ ) {
          if ( y >= this.pages[0][m].cy ) {
            y = this.pages[0][m].y;
            break;
          }
        }

        if ( i == this.currentPage.pageX ) {
          i += this.directionX;

          if ( i < 0 ) {
            i = 0;
          } else if ( i >= this.pages.length ) {
            i = this.pages.length - 1;
          }

          x = this.pages[i][0].x;
        }

        if ( m == this.currentPage.pageY ) {
          m += this.directionY;

          if ( m < 0 ) {
            m = 0;
          } else if ( m >= this.pages[0].length ) {
            m = this.pages[0].length - 1;
          }

          y = this.pages[0][m].y;
        }

        return {
          x: x,
          y: y,
          pageX: i,
          pageY: m
        };
      },

      goToPage: function (x, y, time, easing) {
        easing = easing || this.options.bounceEasing;

        if ( x >= this.pages.length ) {
          x = this.pages.length - 1;
        } else if ( x < 0 ) {
          x = 0;
        }

        if ( y >= this.pages[x].length ) {
          y = this.pages[x].length - 1;
        } else if ( y < 0 ) {
          y = 0;
        }

        var posX = this.pages[x][y].x,
          posY = this.pages[x][y].y;

        time = time === undefined ? this.options.snapSpeed || Math.max(
          Math.max(
            Math.min(Math.abs(posX - this.x), 1000),
            Math.min(Math.abs(posY - this.y), 1000)
          ), 300) : time;

        this.currentPage = {
          x: posX,
          y: posY,
          pageX: x,
          pageY: y
        };

        this.scrollTo(posX, posY, time, easing);
      },

      next: function (time, easing) {
        var x = this.currentPage.pageX,
          y = this.currentPage.pageY;

        x++;

        if ( x >= this.pages.length && this.hasVerticalScroll ) {
          x = 0;
          y++;
        }

        this.goToPage(x, y, time, easing);
      },

      prev: function (time, easing) {
        var x = this.currentPage.pageX,
          y = this.currentPage.pageY;

        x--;

        if ( x < 0 && this.hasVerticalScroll ) {
          x = 0;
          y--;
        }

        this.goToPage(x, y, time, easing);
      },

      _initKeys: function (e) {
        // default key bindings
        var keys = {
          pageUp: 33,
          pageDown: 34,
          end: 35,
          home: 36,
          left: 37,
          up: 38,
          right: 39,
          down: 40
        };
        var i;

        // if you give me characters I give you keycode
        if ( typeof this.options.keyBindings == 'object' ) {
          for ( i in this.options.keyBindings ) {
            if ( typeof this.options.keyBindings[i] == 'string' ) {
              this.options.keyBindings[i] = this.options.keyBindings[i].toUpperCase().charCodeAt(0);
            }
          }
        } else {
          this.options.keyBindings = {};
        }

        for ( i in keys ) {
          this.options.keyBindings[i] = this.options.keyBindings[i] || keys[i];
        }

        utils.addEvent(window, 'keydown', this);

        this.on('destroy', function () {
          utils.removeEvent(window, 'keydown', this);
        });
      },

      _key: function (e) {
        if ( !this.enabled ) {
          return;
        }

        var snap = this.options.snap,   // we are using this alot, better to cache it
          newX = snap ? this.currentPage.pageX : this.x,
          newY = snap ? this.currentPage.pageY : this.y,
          now = utils.getTime(),
          prevTime = this.keyTime || 0,
          acceleration = 0.250,
          pos;

        if ( this.options.useTransition && this.isInTransition ) {
          pos = this.getComputedPosition();

          this._translate(Math.round(pos.x), Math.round(pos.y));
          this.isInTransition = false;
        }

        this.keyAcceleration = now - prevTime < 200 ? Math.min(this.keyAcceleration + acceleration, 50) : 0;

        switch ( e.keyCode ) {
          case this.options.keyBindings.pageUp:
            if ( this.hasHorizontalScroll && !this.hasVerticalScroll ) {
              newX += snap ? 1 : this.wrapperWidth;
            } else {
              newY += snap ? 1 : this.wrapperHeight;
            }
            break;
          case this.options.keyBindings.pageDown:
            if ( this.hasHorizontalScroll && !this.hasVerticalScroll ) {
              newX -= snap ? 1 : this.wrapperWidth;
            } else {
              newY -= snap ? 1 : this.wrapperHeight;
            }
            break;
          case this.options.keyBindings.end:
            newX = snap ? this.pages.length-1 : this.maxScrollX;
            newY = snap ? this.pages[0].length-1 : this.maxScrollY;
            break;
          case this.options.keyBindings.home:
            newX = 0;
            newY = 0;
            break;
          case this.options.keyBindings.left:
            newX += snap ? -1 : 5 + this.keyAcceleration>>0;
            break;
          case this.options.keyBindings.up:
            newY += snap ? 1 : 5 + this.keyAcceleration>>0;
            break;
          case this.options.keyBindings.right:
            newX -= snap ? -1 : 5 + this.keyAcceleration>>0;
            break;
          case this.options.keyBindings.down:
            newY -= snap ? 1 : 5 + this.keyAcceleration>>0;
            break;
          default:
            return;
        }

        if ( snap ) {
          this.goToPage(newX, newY);
          return;
        }

        if ( newX > 0 ) {
          newX = 0;
          this.keyAcceleration = 0;
        } else if ( newX < this.maxScrollX ) {
          newX = this.maxScrollX;
          this.keyAcceleration = 0;
        }

        if ( newY > 0 ) {
          newY = 0;
          this.keyAcceleration = 0;
        } else if ( newY < this.maxScrollY ) {
          newY = this.maxScrollY;
          this.keyAcceleration = 0;
        }

        this.scrollTo(newX, newY, 0);

        this.keyTime = now;
      },

      _animate: function (destX, destY, duration, easingFn) {
        var that = this,
          startX = this.x,
          startY = this.y,
          startTime = utils.getTime(),
          destTime = startTime + duration;

        function step () {
          var now = utils.getTime(),
            newX, newY,
            easing;

          if ( now >= destTime ) {
            that.isAnimating = false;
            that._translate(destX, destY);

            if ( !that.resetPosition(that.options.bounceTime) ) {
              that._execEvent('scrollEnd');
            }

            return;
          }

          now = ( now - startTime ) / duration;
          easing = easingFn(now);
          newX = ( destX - startX ) * easing + startX;
          newY = ( destY - startY ) * easing + startY;
          that._translate(newX, newY);

          if ( that.isAnimating ) {
            rAF(step);
          }
        }

        this.isAnimating = true;
        step();
      },
      handleEvent: function (e) {
        switch ( e.type ) {
          case 'touchstart':
          case 'pointerdown':
          case 'MSPointerDown':
          case 'mousedown':
            this._start(e);
            break;
          case 'touchmove':
          case 'pointermove':
          case 'MSPointerMove':
          case 'mousemove':
            this._move(e);
            break;
          case 'touchend':
          case 'pointerup':
          case 'MSPointerUp':
          case 'mouseup':
          case 'touchcancel':
          case 'pointercancel':
          case 'MSPointerCancel':
          case 'mousecancel':
            this._end(e);
            break;
          case 'orientationchange':
          case 'resize':
            this._resize();
            break;
          case 'transitionend':
          case 'webkitTransitionEnd':
          case 'oTransitionEnd':
          case 'MSTransitionEnd':
            this._transitionEnd(e);
            break;
          case 'wheel':
          case 'DOMMouseScroll':
          case 'mousewheel':
            this._wheel(e);
            break;
          case 'keydown':
            this._key(e);
            break;
          case 'click':
            if ( this.enabled && !e._constructed ) {
              e.preventDefault();
              e.stopPropagation();
            }
            break;
        }
      }
    };
    function createDefaultScrollbar (direction, interactive, type) {
      var scrollbar = document.createElement('div'),
        indicator = document.createElement('div');

      if ( type === true ) {
        scrollbar.style.cssText = 'position:absolute;z-index:9999';
        indicator.style.cssText = '-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;position:absolute;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.9);border-radius:3px';
      }

      indicator.className = 'iScrollIndicator';

      if ( direction == 'h' ) {
        if ( type === true ) {
          scrollbar.style.cssText += ';height:7px;left:2px;right:2px;bottom:0';
          indicator.style.height = '100%';
        }
        scrollbar.className = 'iScrollHorizontalScrollbar';
      } else {
        if ( type === true ) {
          scrollbar.style.cssText += ';width:7px;bottom:2px;top:2px;right:1px';
          indicator.style.width = '100%';
        }
        scrollbar.className = 'iScrollVerticalScrollbar';
      }

      scrollbar.style.cssText += ';overflow:hidden';

      if ( !interactive ) {
        scrollbar.style.pointerEvents = 'none';
      }

      scrollbar.appendChild(indicator);

      return scrollbar;
    }

    function Indicator (scroller, options) {
      this.wrapper = typeof options.el == 'string' ? document.querySelector(options.el) : options.el;
      this.wrapperStyle = this.wrapper.style;
      this.indicator = this.wrapper.children[0];
      this.indicatorStyle = this.indicator.style;
      this.scroller = scroller;

      this.options = {
        listenX: true,
        listenY: true,
        interactive: false,
        resize: true,
        defaultScrollbars: false,
        shrink: false,
        fade: false,
        speedRatioX: 0,
        speedRatioY: 0
      };

      for ( var i in options ) {
        this.options[i] = options[i];
      }

      this.sizeRatioX = 1;
      this.sizeRatioY = 1;
      this.maxPosX = 0;
      this.maxPosY = 0;

      if ( this.options.interactive ) {
        if ( !this.options.disableTouch ) {
          utils.addEvent(this.indicator, 'touchstart', this);
          utils.addEvent(window, 'touchend', this);
        }
        if ( !this.options.disablePointer ) {
          utils.addEvent(this.indicator, utils.prefixPointerEvent('pointerdown'), this);
          utils.addEvent(window, utils.prefixPointerEvent('pointerup'), this);
        }
        if ( !this.options.disableMouse ) {
          utils.addEvent(this.indicator, 'mousedown', this);
          utils.addEvent(window, 'mouseup', this);
        }
      }

      if ( this.options.fade ) {
        this.wrapperStyle[utils.style.transform] = this.scroller.translateZ;
        var durationProp = utils.style.transitionDuration;
        if(!durationProp) {
          return;
        }
        this.wrapperStyle[durationProp] = utils.isBadAndroid ? '0.0001ms' : '0ms';
        // remove 0.0001ms
        var self = this;
        if(utils.isBadAndroid) {
          rAF(function() {
            if(self.wrapperStyle[durationProp] === '0.0001ms') {
              self.wrapperStyle[durationProp] = '0s';
            }
          });
        }
        this.wrapperStyle.opacity = '0';
      }
    }

    Indicator.prototype = {
      handleEvent: function (e) {
        switch ( e.type ) {
          case 'touchstart':
          case 'pointerdown':
          case 'MSPointerDown':
          case 'mousedown':
            this._start(e);
            break;
          case 'touchmove':
          case 'pointermove':
          case 'MSPointerMove':
          case 'mousemove':
            this._move(e);
            break;
          case 'touchend':
          case 'pointerup':
          case 'MSPointerUp':
          case 'mouseup':
          case 'touchcancel':
          case 'pointercancel':
          case 'MSPointerCancel':
          case 'mousecancel':
            this._end(e);
            break;
        }
      },

      destroy: function () {
        if ( this.options.fadeScrollbars ) {
          clearTimeout(this.fadeTimeout);
          this.fadeTimeout = null;
        }
        if ( this.options.interactive ) {
          utils.removeEvent(this.indicator, 'touchstart', this);
          utils.removeEvent(this.indicator, utils.prefixPointerEvent('pointerdown'), this);
          utils.removeEvent(this.indicator, 'mousedown', this);

          utils.removeEvent(window, 'touchmove', this);
          utils.removeEvent(window, utils.prefixPointerEvent('pointermove'), this);
          utils.removeEvent(window, 'mousemove', this);

          utils.removeEvent(window, 'touchend', this);
          utils.removeEvent(window, utils.prefixPointerEvent('pointerup'), this);
          utils.removeEvent(window, 'mouseup', this);
        }

        if ( this.options.defaultScrollbars ) {
          this.wrapper.parentNode.removeChild(this.wrapper);
        }
      },

      _start: function (e) {
        var point = e.touches ? e.touches[0] : e;

        e.preventDefault();
        e.stopPropagation();

        this.transitionTime();

        this.initiated = true;
        this.moved = false;
        this.lastPointX = point.pageX;
        this.lastPointY = point.pageY;

        this.startTime  = utils.getTime();

        if ( !this.options.disableTouch ) {
          utils.addEvent(window, 'touchmove', this);
        }
        if ( !this.options.disablePointer ) {
          utils.addEvent(window, utils.prefixPointerEvent('pointermove'), this);
        }
        if ( !this.options.disableMouse ) {
          utils.addEvent(window, 'mousemove', this);
        }

        this.scroller._execEvent('beforeScrollStart');
      },

      _move: function (e) {
        var point = e.touches ? e.touches[0] : e,
          deltaX, deltaY,
          newX, newY,
          timestamp = utils.getTime();

        if ( !this.moved ) {
          this.scroller._execEvent('scrollStart');
        }

        this.moved = true;

        deltaX = point.pageX - this.lastPointX;
        this.lastPointX = point.pageX;

        deltaY = point.pageY - this.lastPointY;
        this.lastPointY = point.pageY;

        newX = this.x + deltaX;
        newY = this.y + deltaY;

        this._pos(newX, newY);

// INSERT POINT: indicator._move

        e.preventDefault();
        e.stopPropagation();
      },

      _end: function (e) {
        if ( !this.initiated ) {
          return;
        }

        this.initiated = false;

        e.preventDefault();
        e.stopPropagation();

        utils.removeEvent(window, 'touchmove', this);
        utils.removeEvent(window, utils.prefixPointerEvent('pointermove'), this);
        utils.removeEvent(window, 'mousemove', this);

        if ( this.scroller.options.snap ) {
          var snap = this.scroller._nearestSnap(this.scroller.x, this.scroller.y);

          var time = this.options.snapSpeed || Math.max(
              Math.max(
                Math.min(Math.abs(this.scroller.x - snap.x), 1000),
                Math.min(Math.abs(this.scroller.y - snap.y), 1000)
              ), 300);

          if ( this.scroller.x != snap.x || this.scroller.y != snap.y ) {
            this.scroller.directionX = 0;
            this.scroller.directionY = 0;
            this.scroller.currentPage = snap;
            this.scroller.scrollTo(snap.x, snap.y, time, this.scroller.options.bounceEasing);
          }
        }

        if ( this.moved ) {
          this.scroller._execEvent('scrollEnd');
        }
      },

      transitionTime: function (time) {
        time = time || 0;
        var durationProp = utils.style.transitionDuration;
        if(!durationProp) {
          return;
        }

        this.indicatorStyle[durationProp] = time + 'ms';

        if ( !time && utils.isBadAndroid ) {
          this.indicatorStyle[durationProp] = '0.0001ms';
          // remove 0.0001ms
          var self = this;
          rAF(function() {
            if(self.indicatorStyle[durationProp] === '0.0001ms') {
              self.indicatorStyle[durationProp] = '0s';
            }
          });
        }
      },

      transitionTimingFunction: function (easing) {
        this.indicatorStyle[utils.style.transitionTimingFunction] = easing;
      },

      refresh: function () {
        this.transitionTime();

        if ( this.options.listenX && !this.options.listenY ) {
          this.indicatorStyle.display = this.scroller.hasHorizontalScroll ? 'block' : 'none';
        } else if ( this.options.listenY && !this.options.listenX ) {
          this.indicatorStyle.display = this.scroller.hasVerticalScroll ? 'block' : 'none';
        } else {
          this.indicatorStyle.display = this.scroller.hasHorizontalScroll || this.scroller.hasVerticalScroll ? 'block' : 'none';
        }

        if ( this.scroller.hasHorizontalScroll && this.scroller.hasVerticalScroll ) {
          utils.addClass(this.wrapper, 'iScrollBothScrollbars');
          utils.removeClass(this.wrapper, 'iScrollLoneScrollbar');

          if ( this.options.defaultScrollbars && this.options.customStyle ) {
            if ( this.options.listenX ) {
              this.wrapper.style.right = '8px';
            } else {
              this.wrapper.style.bottom = '8px';
            }
          }
        } else {
          utils.removeClass(this.wrapper, 'iScrollBothScrollbars');
          utils.addClass(this.wrapper, 'iScrollLoneScrollbar');

          if ( this.options.defaultScrollbars && this.options.customStyle ) {
            if ( this.options.listenX ) {
              this.wrapper.style.right = '2px';
            } else {
              this.wrapper.style.bottom = '2px';
            }
          }
        }

        var r = this.wrapper.offsetHeight;  // force refresh

        if ( this.options.listenX ) {
          this.wrapperWidth = this.wrapper.clientWidth;
          if ( this.options.resize ) {
            this.indicatorWidth = Math.max(Math.round(this.wrapperWidth * this.wrapperWidth / (this.scroller.scrollerWidth || this.wrapperWidth || 1)), 8);
            this.indicatorStyle.width = this.indicatorWidth + 'px';
          } else {
            this.indicatorWidth = this.indicator.clientWidth;
          }

          this.maxPosX = this.wrapperWidth - this.indicatorWidth;

          if ( this.options.shrink == 'clip' ) {
            this.minBoundaryX = -this.indicatorWidth + 8;
            this.maxBoundaryX = this.wrapperWidth - 8;
          } else {
            this.minBoundaryX = 0;
            this.maxBoundaryX = this.maxPosX;
          }

          this.sizeRatioX = this.options.speedRatioX || (this.scroller.maxScrollX && (this.maxPosX / this.scroller.maxScrollX));
        }

        if ( this.options.listenY ) {
          this.wrapperHeight = this.wrapper.clientHeight;
          if ( this.options.resize ) {
            this.indicatorHeight = Math.max(Math.round(this.wrapperHeight * this.wrapperHeight / (this.scroller.scrollerHeight || this.wrapperHeight || 1)), 8);
            this.indicatorStyle.height = this.indicatorHeight + 'px';
          } else {
            this.indicatorHeight = this.indicator.clientHeight;
          }

          this.maxPosY = this.wrapperHeight - this.indicatorHeight;

          if ( this.options.shrink == 'clip' ) {
            this.minBoundaryY = -this.indicatorHeight + 8;
            this.maxBoundaryY = this.wrapperHeight - 8;
          } else {
            this.minBoundaryY = 0;
            this.maxBoundaryY = this.maxPosY;
          }

          this.maxPosY = this.wrapperHeight - this.indicatorHeight;
          this.sizeRatioY = this.options.speedRatioY || (this.scroller.maxScrollY && (this.maxPosY / this.scroller.maxScrollY));
        }

        this.updatePosition();
      },

      updatePosition: function () {
        var x = this.options.listenX && Math.round(this.sizeRatioX * this.scroller.x) || 0,
          y = this.options.listenY && Math.round(this.sizeRatioY * this.scroller.y) || 0;

        if ( !this.options.ignoreBoundaries ) {
          if ( x < this.minBoundaryX ) {
            if ( this.options.shrink == 'scale' ) {
              this.width = Math.max(this.indicatorWidth + x, 8);
              this.indicatorStyle.width = this.width + 'px';
            }
            x = this.minBoundaryX;
          } else if ( x > this.maxBoundaryX ) {
            if ( this.options.shrink == 'scale' ) {
              this.width = Math.max(this.indicatorWidth - (x - this.maxPosX), 8);
              this.indicatorStyle.width = this.width + 'px';
              x = this.maxPosX + this.indicatorWidth - this.width;
            } else {
              x = this.maxBoundaryX;
            }
          } else if ( this.options.shrink == 'scale' && this.width != this.indicatorWidth ) {
            this.width = this.indicatorWidth;
            this.indicatorStyle.width = this.width + 'px';
          }

          if ( y < this.minBoundaryY ) {
            if ( this.options.shrink == 'scale' ) {
              this.height = Math.max(this.indicatorHeight + y * 3, 8);
              this.indicatorStyle.height = this.height + 'px';
            }
            y = this.minBoundaryY;
          } else if ( y > this.maxBoundaryY ) {
            if ( this.options.shrink == 'scale' ) {
              this.height = Math.max(this.indicatorHeight - (y - this.maxPosY) * 3, 8);
              this.indicatorStyle.height = this.height + 'px';
              y = this.maxPosY + this.indicatorHeight - this.height;
            } else {
              y = this.maxBoundaryY;
            }
          } else if ( this.options.shrink == 'scale' && this.height != this.indicatorHeight ) {
            this.height = this.indicatorHeight;
            this.indicatorStyle.height = this.height + 'px';
          }
        }

        this.x = x;
        this.y = y;

        if ( this.scroller.options.useTransform ) {
          this.indicatorStyle[utils.style.transform] = 'translate(' + x + 'px,' + y + 'px)' + this.scroller.translateZ;
        } else {
          this.indicatorStyle.left = x + 'px';
          this.indicatorStyle.top = y + 'px';
        }
      },

      _pos: function (x, y) {
        if ( x < 0 ) {
          x = 0;
        } else if ( x > this.maxPosX ) {
          x = this.maxPosX;
        }

        if ( y < 0 ) {
          y = 0;
        } else if ( y > this.maxPosY ) {
          y = this.maxPosY;
        }

        x = this.options.listenX ? Math.round(x / this.sizeRatioX) : this.scroller.x;
        y = this.options.listenY ? Math.round(y / this.sizeRatioY) : this.scroller.y;

        this.scroller.scrollTo(x, y);
      },

      fade: function (val, hold) {
        if ( hold && !this.visible ) {
          return;
        }

        clearTimeout(this.fadeTimeout);
        this.fadeTimeout = null;

        var time = val ? 250 : 500,
          delay = val ? 0 : 300;

        val = val ? '1' : '0';

        this.wrapperStyle[utils.style.transitionDuration] = time + 'ms';

        this.fadeTimeout = setTimeout((function (val) {
          this.wrapperStyle.opacity = val;
          this.visible = +val;
        }).bind(this, val), delay);
      }
    };

    IScroll.utils = utils;

    if ( typeof module != 'undefined' && module.exports ) {
      module.exports = IScroll;
    } else if ( typeof define == 'function' && define.amd ) {
      define( 'iscroll',[],function () { return IScroll; } );
    } else {
      window.IScroll = IScroll;
    }

  })(window, document, Math);

  define('text!tmpl/products-mobile.html',[],function () { return '<% if (products.length) { %>\n   <% _.each(products, function(product){ %>\n    <% if (product.id){ %>\n    <div>\n        <a id="product-<%= product.id %>" href="<%=product.data.linkUrl%>" class="prd-item" target="_blank">\n            <div class="prd-item-graphic">\n                <div style="background-image:url(<%=product.data.imageUrl%>);"></div>\n            </div>\n            <div class="prd-item-text">\n                <h2 class="prd-item-title"><%= product.title %></h2>\n                    <div class="bottom-description">\n                        <% if (data.mpn) { %>\n                        <h3 class="prd-item-model">MODEL#: <%=data.mpn %></h3>\n                        <% } %>\n                        <% if(product.data.rating){ %>\n                            <div class="prd-ratings">\n                                <div class="prd-rating-box">\n                                    <div class="prd-rating" style="width:<%=product.data.rating %>%;"></div>\n                                </div>\n                                <% if(product.data.reviews){ %>\n                                    <div class="prd-reviews"><%=product.data.reviews %> Review(s)</div>\n                                <%}%>\n                            </div>\n                        <%}%>\n                        <% if (product.data.price) { %>\n                        <span class="prd-item-price">$<%= product.data.price %></span>\n                        <% } %>\n                    </div>\n            </div>\n            <div class="action-wrapper">\n                <button class="call-to-action-add">Add to cart </button>\n                <button class="call-to-action-view">View details </button>\n            </div>\n        </a>\n    </div>\n    <% } %>\n   <% }); %>\n<% } %>';});

  define('src/js/products/index',['require','underscore','jquery-private','iscroll','../jquery.pubsub-loader','slick','text!tmpl/products-mobile.html'],function(require) {

    var _ = require("underscore");
    var $ = require("jquery-private");
    var IScroll = require('iscroll');

    require('../jquery.pubsub-loader');
    
    if ("undefined" === typeof jQuery.fn.slick) {
      require('slick');
    }

    var htmlMobile = require('text!tmpl/products-mobile.html');

    var $el = null,
      options = null,
      mobile = $(window).width() < 768,
      scrollerSettings = {
        click: true,
        mouseWheel: true,
        scrollbars: 'custom',
        interactiveScrollbars: true,
        bounce: false,
      },
      isTouch = ('ontouchstart' in window || navigator.maxTouchPoints);

    function sendAnalitics(data, type) {
      if ('object' === typeof data && type) {
        if (window._tvpa) {
          return _tvpa.push(['track', type, $.extend(data, {
            li: _tvp.lid,
            pg: _tvp.channelId
          })]);
        }
      }
    }

    function startMobile(html) {
      var sliderId = 'tvpprd-slider';
      $('.watch-more-tvp-mobile').show();
      $el.html($('<div/>').attr('id', sliderId));
      var $slider = $el.find('#' + sliderId).html(html).find('script').off().remove().end();
      $slider.find('div[itemprop="product"]').off().remove();

      _.defer(function() {
        startTracking();
        $slider.slick({
          arrows: false,
          infinite: true,
          slidesToShow: 1,
          slidesToScroll: 1,
          dots: true
        });
      });
    }

    var hidePopup = function() {
      $(this).removeClass("active");
      $el.find('.product-popup.active').hide();
    };

    var showPopup = function() {
      $el.find('.product-popup.active').hide();

      //update top right matching thumbnail location
      var $prodThumbnail = $(this).addClass("active");
      var $productPopup = $el.find('#product-popup-'+$prodThumbnail.attr('id').split('-').pop());
      var topValue = $prodThumbnail.position().top;
      $productPopup.css({ 
        top: topValue,
        right: $prodThumbnail.width() + 13
      });

      //move it there if not yet well located
      if ($productPopup.hasClass('moved')) {
        $productPopup.addClass('active').show();
      } else {
        $productPopup.appendTo($el).addClass('moved active').show();
      }

      //correct popup top location.
      var popupHeight = $productPopup.height();
      var popupBottomEdge = $productPopup.offset().top + popupHeight;
      var $modal = $('.lb-content');
      var modalBottomEdge = $modal.offset().top+$modal.height();
      var top = $prodThumbnail.offset().top-$modal.offset().top;
      var excess = 0;
      if (top < 0) {
        topValue = -39;
      } else if (popupBottomEdge > modalBottomEdge) {
        excess = popupBottomEdge - modalBottomEdge + 18;
      }
      $productPopup.css({
        top: topValue - excess
      });

      //arrow indicator location.
      var arrowTop = ($prodThumbnail.offset().top - $productPopup.offset().top) + 15;
      if (arrowTop < 0) {
        arrowTop = 10;
      } else if (arrowTop > popupHeight) {
        arrowTop = modalBottomEdge - 10;
      }

      $productPopup.find('.arrow-indicator').css('top', arrowTop);
    };

    function startDesktop(html) {
      var scrollId = 'tvpprd-scroller';
      $('.watch-more-tvp-mobile').hide();
      $el.append("<span id=\"lb-header-rp\">Related Products</span>").append($('<div/>').attr('id', scrollId));
      $el.find('#' + scrollId).html(html).promise().done(function() {
        var scroller = new IScroll('#tvpprd-scroller', scrollerSettings);
        setTimeout(function() { scroller.refresh(); }, 0);
      });
      $el.find('script').off().remove().end().find('div[itemprop="product"]').off().remove();

      if (!isTouch) {
        $el.on('mouseleave', hidePopup);
        $el.on('mouseover', '.product', showPopup);
      } else {
        $(document).on('click', '.product', function(e){
          e.preventDefault();
          return false;
        });
        $(document).on('touchend', '.product', showPopup);
        $(document).on('touchend', '.product.active', hidePopup);
        $(document).on('touchend', function(e){
          if ( !$(e.target).is("#tvpprd-scroller") && !$("#tvpprd-scroller").has(e.target).length && !$(".product-popup.moved.active").has(e.target).length) {
            $('.product').removeClass("active");
            hidePopup();
          }
        });
      }
    }

    function productsLoaded(products, productHtml) {
      if (products.length) {
        $el.show();
        $.each(products, function(index, product) {
          sendAnalitics({ ct: product.id, vd: product.entityIdParent }, 'pi')
        });
        if (mobile) {
          startMobile(_.template(htmlMobile)({
            products: products
          }));
        } else {
          startDesktop(productHtml);
          for (var i = 0; i < products.length; i++) {
            var rate = 0;
            var prod = products[i];
            
            if ("undefined" !== typeof prod.rating && null !== prod.rating) {
              rate = Number(prod.rating);
            }
            var rateHtml = "";
            if (rate>0){
              var fulls = 0;
              var half = false;
              if(rate % 1 != 0){
                half = true;
                fulls = Math.floor(rate);
              } else {
                fulls = rate;
              }
              
              var empties = 0;
              if (4 === fulls && half) {
                empties = 0;
              } else if (1 === fulls && half) {
                empties = 3;
              } else if (half) {
                empties = (5 - fulls) - 1;
              } else {
                empties = 5 - fulls;
              }
              
              rateHtml = '<ul class="tvp-product-rating">';
              for (var j = 0; j < fulls; j++) {
                rateHtml += '<li class="star star-full"></li>';
              }
              if(half){
                rateHtml += '<li class="star star-half"></li>';
              }
              for (var k = 0; k < empties; k++) {
                rateHtml += '<li class="star star-empty"></li>';
              }

              if ("undefined" !== typeof prod.review_count && null !== prod.review_count) {
                rateHtml += '<li>'+prod.review_count+' Reviews</li>';
              }

              rateHtml += '</ul>';
            }

            $("#product-popup-"+products[i].id).find('.product-price').after(rateHtml);

          }
        }

      } else {
        $el.hide();
      }

      $.publish('products:loaded', [products]);
    }

    $.ajaxSetup({headers:{'X-Login-Id':_tvp.lid}});

    // Syncs with the backend cartridge.
    function loadCartridge(e, video) {
      if (video) {
        $.ajax({
          url: _tvp.relatedProductsDesktop,
          type: 'post',
          dataType: "json",
          data: JSON.stringify({
            includeData: true,
            channelId: _tvp.channelId,
            videoId: video.id
          }),
          success: function(response) {
            var products = [];
            if ( response && "undefined" !== typeof response.cartridgeData && "undefined" !== typeof response.cartridgeData.products) {
              products = response.cartridgeData.products;
            }

            var productHtml = "";
            if ( response && "undefined" !== typeof response.html) {
              productHtml = response.html;
            }

            $el.html("");
            setTimeout(function() {
              productsLoaded(products, productHtml); 
            }, 0);

          }
        });
      }
    }

    return {
      init: function(opts, callback) {
        options = opts || {};
        $el = $('<div>').attr('id', 'tvpprd').append("<span id=\"lb-header-rp\">Related Products</span>").appendTo(opts.place);
        $.subscribe('player:play-video', loadCartridge);
        $.subscribe('light-box:hiding', function() {
          if (!mobile) $el.html("");
        });

        var track = function(pid, parent){sendAnalitics({ct: pid, vd: parent },'pk')};

        $(document).on('click', '.product-title', function(){
          track( $(this).attr("data-pid"), $(this).attr("data-parent") );
        });

        $(document).on('click', '.tvp-view-now', function(){
          track( $(this).attr("data-pid"), $(this).attr("data-parent") );
        });

        $(document).on('click', '.product', function(){
          track( $(this).attr("data-pid"), $(this).attr("data-parent") );
        });

        $(document).on('click', '.tvp-rating', function(){
          track( $(this).attr("data-pid"), $(this).attr("data-parent") );
        });

        $(document).on('click', '.call-to-action', function(){
          window.open($(this).attr("data-url"),'_blank');
        });

        if (_.isFunction(callback)) {
          callback();
        }
      }
    };


  });
  define('src/js/index',['require','jquery-private','text!static/js-css.css','./jquery.pubsub-loader','./config','./carousel/index','./light-box/index','./player/index','./products/index'],function(require) {

    var $ = require('jquery-private');
    if (!$('#tvp-css-lib').length) {
      $('<style/>').attr('id', "tvp-css-lib").html(require('text!static/js-css.css')).appendTo('head');
    }

    require('./jquery.pubsub-loader');
    require('./config');
    require('./carousel/index');

    var lightBox = require('./light-box/index');
    var player = require('./player/index');

    lightBox.init(function() {

      var options = {
        place: '#tvplb .lb-body'
      };

      player.init(options, function() {

        $(document).on('click', '.tvp-video', function(e) {

          e.preventDefault();
          e.stopPropagation();
          var index = $(e.currentTarget).attr('data-index');
          if (null !== typeof index && 'undefined' !== typeof index) {
            $.publish('light-box:show');
            $.publish('player:play', index);
          }

        });

        setTimeout(function () {
          $( "#tvp-gallery" ).fadeTo( 25 , 1, function() {
            // Animation complete.
          });
        },0);

      });

      var products = require('./products/index');
      products.init(options);

    });

  });


  require(["src/js/index"]);
}());