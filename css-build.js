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


define('text!static/js-css.css',[],function () { return '.tvp-gallery-headline {\n    margin: 15px 0 12px 15px;\n    font-family: FuturaStdHeavy;\n    font-size: 18px !important;\n}\n.tvp-gallery-headline > span {\n    text-transform: uppercase;\n    font-family: FuturaStdHeavy;\n}\n.tvp-skel-row {\n    height: 9px;\n    background-color: #f7f7f7;\n    margin-top: 10px;\n    border: 1px solid #e8e8e8;\n}\n.tvp-skel-row.tvp-mid {\n    width: 40%;\n}\n.tvp-hidden {\n    display: none !important;\n}\n#lb-header-rp {\n    display: none !important;\n    position: absolute;\n    right: 0;\n    top: -16px;\n    font-size: 10px;\n    width: 100%;\n    text-align: center;\n}\n#tvpprd .arrow-indicator {\n    background-color: transparent;\n    width: 36px;\n    height: 58px;\n    position: absolute;\n    top: 20px;\n    right: -36px;\n}\n#tvpprd .arrow-indicator:before {\n    content: " ";\n    width: 0;\n    height: 0;\n    border-top: 15px solid transparent;\n    border-bottom: 15px solid transparent;\n    border-left: 13px solid #e8e8e8;\n    position: absolute;\n    top: 0;\n    left: 1px;\n    margin-left: auto;\n    margin-right: auto;\n}\n#tvpprd .arrow-indicator:after {\n    content: " ";\n    width: 0;\n    height: 0;\n    border-top: 15px solid transparent;\n    border-bottom: 15px solid transparent;\n    border-left: 13px solid #fff;\n    position: absolute;\n    top: 0;\n    left: -1px;\n}\n#tvp-gallery {\n    -webkit-transition: height 600ms cubic-bezier(0.22, 0.3, 0.37, 0.92);\n            transition: height 600ms cubic-bezier(0.22, 0.3, 0.37, 0.92);\n    height: 0px;\n    overflow:hidden;\n    position: relative;\n    opacity: 0.85;\n    margin: 8px 0 29px 0;\n}\n#tvp-gallery.ready {\n    background-color: #EEEEEE;\n}\n#tvp-gallery.tvp-skel {\n    height: auto;\n    opacity: 0.5;\n}\n#tvp-gallery #tvpchg-slider *,\n#tvp-gallery #tvpchg-slider-2 *{\n    outline: none;\n}\n#tvpchg-slider-shield {\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    background-color: transparent;\n    z-index:9999;\n    cursor: wait;\n}\n\n#tvp-gallery #tvpchg-slider.slick-slider,\n#tvp-gallery #tvpchg-slider-2.slick-slider{\n    margin: 0px 0 35px 0;\n}\n#tvp-gallery #tvpchg-slider.slick-slider.ready,\n#tvp-gallery #tvpchg-slider-2.slick-slider.ready{\n    margin: 0px 13px 13px 10px;\n}\n@media screen and (max-width: 767px) {\n    #tvp-gallery #tvpchg-slider.slick-slider .slick-list,\n    #tvp-gallery #tvpchg-slider-2.slick-slider .slick-list{\n        padding-left: 0 !important;\n        margin: 0 0 0 -5px !important;\n    }\n}\n#tvp-gallery #tvpchg-slider.slick-slider .slick-dots,\n#tvp-gallery #tvpchg-slider-2.slick-slider .slick-dots{\n    position: relative;\n    bottom: 0;\n    padding-top: 0;\n    padding-bottom: 0;\n    margin: 0px;\n}\n#tvp-gallery #tvpchg-slider .slick-arrow,\n#tvp-gallery #tvpchg-slider-2 .slick-arrow {\n    z-index: 2;\n    line-height: 0;\n    display: block !important;\n    width: 36px;\n    height: 36px;\n    position: absolute;\n    color: transparent;\n    -webkit-transform: translateY(-50%);\n    transform: translateY(-50%);\n    top: 32%;\n    padding: 0;\n    cursor: pointer;\n    border: none;\n    outline: none;\n}\n#tvp-gallery #tvpchg-slider .slick-prev.slick-disabled,\n#tvp-gallery #tvpchg-slider-2 .slick-prev.slick-disabled {\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAMAAADW3miqAAAAOVBMVEX////////8/Pz6+vr5+fn5+fn4+Pj29vb09PT29vby8vLx8fHw8PDw8PDw8PDw8PDw8PDw8PDv7+/FtFDQAAAAEnRSTlOAhZSbn6Cuvb+/3u3w8/r8/f5HjYQsAAAASUlEQVR4Ae3K2wmAMBAEwDWa8x11+y9W0oB7CIKBm+9BeG1YEpRcuCd9yNVxODrO9JvTOw6sniPj2VxXaXpt0OsyyHUatA7hMzdLOQX/ljGVnwAAAABJRU5ErkJggg==)  0 0 no-repeat;\n    opacity: 1 !important;\n}\n\n#tvp-gallery #tvpchg-slider .slick-prev,\n#tvp-gallery #tvpchg-slider-2 .slick-prev{\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAAAAADEa8dEAAAAfklEQVQ4y+3TMQ6AIAwFUO5/g0qYjIm71xAP0B0TJw7goIBToVAWN5jf0Pz/UU/HUwNx6Ny8iJyB2QsoGIC1jZKBo4k+szdvYk2GeENRxRB0VQxBGI12QuI2KuOEWioqi4BXeZisKmrhVFlwUos0laAmFEdnNXbM9x4/+D/0ApZm572vLMrdAAAAAElFTkSuQmCC) 0 0 no-repeat;\n    left: -10px;\n}\n#tvp-gallery #tvpchg-slider .slick-prev:not(.slick-disabled):hover,\n#tvp-gallery #tvpchg-slider-2 .slick-prev:not(.slick-disabled):hover{\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAMAAADW3miqAAAAPFBMVEX////n5+exsbGdnZ2UlJSSkpJ5eXl4eHhkZGRjY2NiYmJGRkY8PDw7Ozs5OTk1NTU0NDQ1NTUzMzMzMzO2cabbAAAAE3RSTlNNVGlzeXqNjqOlptHl6u74+/z9yW1l7QAAAEpJREFUeAHtytsJgDAQRcFjNMZ31O2/V0kD3kUQFDLfQ/VYNweUmG0L+pgtjmOD40yfOa3jkMrZI/fGsvKv14peZ49cR0JrqF5zAUhHBloYYs0+AAAAAElFTkSuQmCC) 0 100% no-repeat;\n}\n\n#tvp-gallery #tvpchg-slider .slick-next,\n#tvp-gallery #tvpchg-slider-2 .slick-next{\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAAAAADEa8dEAAAAeklEQVQ4y+3TMQ6AIAwFUO5/g0qYjIm710APwI4JEwdw0BAnf3+AxY3OL2n705q7o8xAgPJ2NlGexcUWWkWY+qJDqIKZPFW4HVUqAqZ0TkSRMF+V6ijaokIVRVeMr7YjRiFmEFEDiBtACzWAwsQMzhTs3nG+1/jgn9EDlzrntusNQNoAAAAASUVORK5CYII=) 100% 0 no-repeat;\n    right: -14px;\n}\n#tvp-gallery #tvpchg-slider .slick-next:not(.slick-disabled):hover,\n#tvp-gallery #tvpchg-slider-2 .slick-next:not(.slick-disabled):hover{\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAMAAADW3miqAAAAPFBMVEX////n5+exsbGdnZ2UlJSSkpJ5eXl4eHhkZGRjY2NiYmJGRkY8PDw7Ozs5OTk1NTU0NDQ1NTUzMzMzMzO2cabbAAAAE3RSTlNNVGlzeXqNjqOlptHl6u74+/z9yW1l7QAAAEpJREFUeNrtylEKgCAQBcBnZZZZanv/u8ZewCeBoOB8D6Y/lmvj55FoQQQRvg6pWb7rtaLIJl2ufKIeP9TBzY7aXz2Myyc4g6mtD1PABmF2MmX4AAAAAElFTkSuQmCC) 100% 100% no-repeat;\n}\n#tvp-gallery #tvpchg-slider .slick-next.slick-disabled,\n#tvp-gallery #tvpchg-slider-2 .slick-next.slick-disabled {\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAMAAADW3miqAAAAOVBMVEX////////8/Pz6+vr5+fn5+fn4+Pj29vb09PT29vby8vLx8fHw8PDw8PDw8PDw8PDw8PDw8PDv7+/FtFDQAAAAEnRSTlOAhZSbn6Cuvb+/3u3w8/r8/f5HjYQsAAAASUlEQVR42u3KSQqAMBAEwDaaRbM6/3+szAfSEhAMpM6FZYS5Dn6yFAsiivDl5c0Kv147umzV5fqn6AlTHSR2lLvp0dVOcBuWbz05ewX4xJspIwAAAABJRU5ErkJggg==)  100% 0 no-repeat;\n    opacity: 1 !important;\n}\n\n#tvp-gallery #tvpchg-slider ul,\n#tvp-gallery #tvpchg-slider-2 ul{\n    display: block;\n    position: relative;\n    text-align: center;\n    list-style: none;\n    padding-top: 2px;\n    padding-bottom: 8px;\n}\n#tvp-gallery #tvpchg-slider ul > li,\n#tvp-gallery #tvpchg-slider-2 ul > li{\n    display: inline-block;\n    margin-right: 0;\n    width: 17px;\n    height: 16px;\n}\n#tvp-gallery #tvpchg-slider ul > li button,\n#tvp-gallery #tvpchg-slider-2 ul > li button{\n    width: 13px;\n    height: 14px;\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAsCAYAAAC+GzLvAAAD0UlEQVR42sRVTWhcVRS+f/PmpzPzZiK4ETfWjQqlNNhSiFRcFGGoIW4qLZJg/UMpunDRGKQLfxItimAtIWYj0oUbkRHMgFCMASOKUBCFqrUIIhFqESaZmbz77r1+5743cWomnVEXHjjcd8893/l555x7uXOOdWl2dvYWLM+AR1O+BP4SvDA9Pf1NV493QXNzc8eEEOeklCGY4ZvRmTGGxXEcWWvPYH8aYKNSwIlMJrOYz+cZcRAEjIBQZFEUsU6nE7RarRmtdQj1kzKXy41ks9mPy+VyrlKpsFKpxAqFAoOcQb61kmd43b+8vLyk4OEoFMNqteq90GEvkUellF855+R9SsHSQbLeD9AlkpNHyg+hjglswq77GxF5oVxhvCgQ3hq5HoZIj/QFLDTIyjBEeoioIZBYHXxxGBDqtI68zorJyUms5jgE1wZgDIp8HHTNZz8xMfEdgAfSlulHV3B+eHx8vH5dG3VpaWnpEGKv4ZOqH4E/AaBRq9Wibb33T0iwf0Gqd1N66w8/GiIjRrlgowjiko0c8nQLzZOV7aNRevP3YzIvz8mAh1xyKgr9ZOYMYzayUdwyZyA43Xz2pmQ0Sm/8dkLtkosyaxkXaaHTVOGR8SwLYGNGN2M/Grz46i8jMid/UgUZ8htlCCNxGwPZMgcUxvKo4C7kxqJ8A/4ad1TiKcVjfZDHFMvg/uPWMeHMmAIy9CA3RNNCjcemqFy0ueYixbgaAgRPLjJrikW64Tr2cRYMrrPTjtl23FBM67rZiC8KK/f6+uwEoP/UMetM27O+uKWnV+6UGbGismKkH9AhLBM5E2+aB5tv31P/qyOe/PR2Ifl5GYj9vsBJQySA2F2x2j7anL/3Qt8uLz124RCWGjogxJEfDXCj+c59/8No/Pd5+mjm8s3I5SF83pHyz+BvkcEHR17e/eO2nAC4H8spcLGbZs91qMHvQT7/wCu7rfdUf/7yOJYX/NC53ntuC5jB1yOQFPH9Gv/w1A9lwpGH9EK8vrMZ//sATCooHcZBAmCuT2O7pLtTJPZHAGJ7UumAqdgKfa9CmxQTAGc7vgOJsyR0xwrKWneVlOl5cjsAXdq0NgFdxavhVo2hV9x5Sz6EHqa9pabFHWITnVV6apY31je/73Q0upkOrFciq8Z3uGWxNqy1gVe+rVsQv++LO//w17e1W9FiJpDlwi560ZW//7xyS7M2APRGh9XCc1MLez7b6ojXJz6/FdZewvYuKYW/JK1JwlIZ+Wt1JP/iU+fv/qrvaMzWVvbpyIxBXgQ4zubUF+VKfvWJd/fprs6fAgwAlv8CCnsWGMoAAAAASUVORK5CYII=);\n    background-color: transparent;\n    background-position: 0px 0px;\n    background-repeat: no-repeat;\n    color: transparent;\n}\n#tvp-gallery #tvpchg-slider ul > li button:before,\n#tvp-gallery #tvpchg-slider-2 ul > li button:before {\n    content: "";\n    color: transparent;\n}\n#tvp-gallery #tvpchg-slider ul > li button:hover,\n#tvp-gallery #tvpchg-slider-2 ul > li button:hover {\n    background-position: 0px -15px;\n}\n#tvp-gallery #tvpchg-slider ul > li.slick-active > button,\n#tvp-gallery #tvpchg-slider-2 ul > li.slick-active > button {\n    background-position: 0px -15px;\n    background-color: transparent;\n    color: transparent;\n}\n#tvp-gallery #tvpchg-slider .tvp-video,\n#tvp-gallery #tvpchg-slider-2 .tvp-video{\n    display: block;\n    margin: 0 5px;\n    text-decoration: none;\n    color: #000;\n    cursor: pointer;\n    outline: none;\n}\n@media screen and (max-width: 767px) {\n    #tvp-gallery #tvpchg-slider .tvp-video:first-child,\n    #tvp-gallery #tvpchg-slider-2 .tvp-video:first-child {\n        margin-left: 0px;\n    }\n}\n#tvp-gallery #tvpchg-slider .tvp-video.active .video-overlay,\n#tvp-gallery #tvpchg-slider-2 .tvp-video.active .video-overlay {\n    opacity: 1;\n}\n#tvp-gallery #tvpchg-slider .tvp-video.active .video-playing,\n#tvp-gallery #tvpchg-slider-2 .tvp-video.active .video-playing {\n    opacity: 1;\n}\n#tvp-gallery #tvpchg-slider .tvp-video.active .video-play-button,\n#tvp-gallery #tvpchg-slider-2 .tvp-video.active .video-play-button {\n    display: none;\n}\n#tvp-gallery #tvpchg-slider .tvp-video:not(.active):hover .video-play-button,\n#tvp-gallery #tvpchg-slider .tvp-video:not(.active):hover .play-now,\n#tvp-gallery #tvpchg-slider .tvp-video:not(.active):hover .video-overlay,\n#tvp-gallery #tvpchg-slider-2 .tvp-video:not(.active):hover .video-play-button,\n#tvp-gallery #tvpchg-slider-2 .tvp-video:not(.active):hover .play-now,\n#tvp-gallery #tvpchg-slider-2 .tvp-video:not(.active):hover .video-overlay {\n    opacity: 1;\n}\n#tvp-gallery #tvpchg-slider .tvp-video:focus,\n#tvp-gallery #tvpchg-slider-2 .tvp-video:focus {\n    outline: none;\n}\n#tvp-gallery #tvpchg-slider .tvp-video p,\n#tvp-gallery #tvpchg-slider-2 .tvp-video p {\n    margin: 0;\n}\n#tvp-gallery #tvpchg-slider .tvp-video .tittle,\n#tvp-gallery #tvpchg-slider-2 .tvp-video .tittle {\n    display: block;\n    margin: 8px 0 12px 0;\n    text-align: left;\n    line-height: 18px;\n    font-family: Arial, Helvetica, sans-serif;\n    color: #444;\n    overflow: hidden;\n    text-transform: capitalize;\n    font-size: 13px;\n    height: 38px;\n    overflow: hidden;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image {\n    position: relative;\n    background-repeat: no-repeat;\n    background-position: center;\n    background-size: 102%;\n    position: relative;\n    pointer-events: none;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image:before,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image:before {\n    display: block;\n    content: "";\n    width: 100%;\n    padding-top: 56.25%;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image > .ar-content,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image > .ar-content {\n    position: absolute;\n    top: 0;\n    left: 0;\n    right: 0;\n    bottom: 0;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image .video-overlay,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image .video-overlay {\n    -webkit-transition: all 0.25s ease;\n    transition: all 0.25s ease;\n    pointer-events: none;\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    background-color: rgba(0, 0, 0, 0.2);\n    opacity: 0;\n}\n#tvp-gallery #tvpchg-slider .tvp-skel-overlay {\n    pointer-events: none;\n    background-color: rgb(247, 247, 247);\n    padding-top: 56.25%;\n    border: 1px solid #e8e8e8;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image .video-playing,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image .video-playing {\n    text-align: center;\n    color: #fff;\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    height: 25px;\n    margin: auto;\n    font-weight: bold;\n    line-height: 25px;\n    opacity: 0;\n    font-size: 1.2em;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-image .play-now,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-image .play-now {\n    text-align: center;\n    color: #fff;\n    position: absolute;\n    bottom: 0;\n    right: 0;\n    height: 25px;\n    margin: auto;\n    font-weight: bold;\n    line-height: 25px;\n    opacity: 0;\n    font-size: 1.2em;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-play-button,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-play-button {\n    position: absolute;\n    top: 50%;\n    left: 50%;\n    -webkit-transform: translate(-50%, -50%);\n    transform: translate(-50%, -50%);\n    width: 37px;\n    height: 37px;\n    border: 1px solid rgb(102, 102, 102);\n    border-radius: 50%;\n    background-color: #eeeeee;\n    -webkit-backface-visibility: hidden;\n            backface-visibility: hidden;\n}\n#tvp-gallery #tvpchg-slider .tvp-video-play-button:after,\n#tvp-gallery #tvpchg-slider-2 .tvp-video-play-button:after {\n    content: \'\';\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    margin: auto;\n    right: 0;\n    left: 3px;\n    width: 0;\n    height: 0;\n    border-top: 9px solid transparent;\n    border-bottom: 9px solid transparent;\n    border-left: 16px solid #273691;\n}\n\n.tvp-progress-bar {\n    background-color: #273691 !important;\n}\n\n#tvplb.off {\n    visibility: hidden;\n    opacity: 0;\n    pointer-events: none;\n}\n#tvplb .lb-overlay {\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    -webkit-transition: opacity .35s ease-in-out;\n            transition: opacity .35s ease-in-out;\n    background-color: rgba(0, 0, 0, 0.45);\n    position: fixed;\n    z-index: 9999;\n    overflow: hidden;\n    -webkit-overflow-scrolling: touch;\n    outline: 0;\n    visibility: visible;\n    opacity: 1;\n    pointer-events: auto;\n    display: none;\n}\n#tvplb .lb-content {\n    -webkit-transition: opacity .25s ease-in-out;\n            transition: opacity .25s ease-in-out;\n    background-color: #FFF;\n    border-radius: 2px;\n    position: fixed;\n    z-index: 999999;\n    width: 50%;\n    margin: 0 auto;\n    left: 0;\n    right: 0;\n    top: 0;\n    border-radius: 1px;\n}\n@media screen and (min-height: 390px) {\n    #tvplb .lb-content {\n        width: 100%;\n    }\n}\n@media screen and (min-width: 768px) {\n    #tvplb .lb-content {\n        background-color: #FFF;\n        -webkit-transform: translateY(-50%);\n        transform: translateY(-50%);\n        width: 90%;\n        margin: 0 auto;\n        left: 0;\n        right: 0;\n        top: 50%;\n    }\n}\n@media screen and (min-width: 960px) {\n    #tvplb .lb-content {\n        max-width: 800px;\n    }\n}\n#tvplb .lb-header {\n    padding: 0 10px;\n    position: relative;\n    background-color: #FFF;\n    height: 40px;\n}\n#tvplb .lb-header:after {\n    content: "";\n    display: table;\n    clear: both;\n}\n#tvplb .lb-header .watch-more-tvp {\n    display: none !important;\n}\n#tvplb .lb-header .watch-more-tvp:after {\n    content: "";\n    display: table;\n    clear: both;\n}\n@media screen and (min-width: 768px) {\n    #tvplb .lb-header .watch-more-tvp {\n        display: block;\n        position: relative;\n        top: 35%;\n        -webkit-transform: translateY(-50%);\n        transform: translateY(-50%);\n        text-decoration: none;\n        float: right;\n        height: 18px;\n        margin-right: 35px;\n    }\n    #tvplb .lb-header .watch-more-tvp span {\n        font-size: 11px;\n        display: inline-block;\n        color: #273691;\n    }\n    #tvplb .lb-header .watch-more-tvp span span {\n        color: #273691;\n        text-decoration: underline;\n    }\n}\n#tvplb .lb-title {\n    color: #444444;\n    padding-left: 18px;\n    margin: 10px 0 30px 0;\n    text-transform: capitalize;\n    font-family: FuturaStdHeavy;\n    font-size: 17px;\n}\n#tvplb .lb-header .lb-close {\n    display: block;\n    float: right;\n    width: 20px;\n    height: 20px;\n    position: relative;\n    cursor: pointer;\n    padding: 0;\n    top: 10px;\n    right: -3px;\n    border: 0;\n    background-color: transparent;\n    opacity: 0.85;\n}\n#tvplb .lb-header .lb-close:hover {\n    opacity: 1;\n}\n#tvplb .lb-header .lb-close:after {\n    width: 18px;\n    height: 18px;\n    background-size: cover;\n    background-repeat: no-repeat;\n    background-position: center;\n    content: \' \';\n    display: block;\n    position: absolute;\n    right: 0;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    margin: auto;\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAAKlBMVEVERET///9ERERERERERERERERERERERERERERERERERERERERERERERETSMAiNAAAADXRSTlMAABFVZneImaq7zN3uzgT4UwAAAIhJREFUeAFlz0FuwCAQQ9FvSCCQ+P7XbYWUOqizfH8zBmh+Ku+pTI8iAd22jzf8uj2LlqcsX4XTTnndHgynxG2aUz4+oafc8cJW4mIrcbGVuNhKXPwr93Jlb75OiKewewq7p7B7ytdnT6lc8ULKw4gDKdSvpzQ44ildrBJHfbkA6rj+HKmNU9IPbVYS6LhZ+T4AAAAASUVORK5CYII=);\n}\n#tvplb .lb-body {\n    padding: 0;\n    margin: 0 17px 0 18px;\n    position: relative;\n}\n#tvplb .lb-body:after {\n    content: "";\n    display: table;\n    clear: both;\n}\n\n.tvp-controls-mp4 .tvp-control-overlay {\n    bottom: 0px;\n    margin: auto;\n    height: 100% !important;\n}\n\n.tvp-hide-mp4 {\n    display: none !important;\n}\n\n#tvpp{\n    background-color: black;\n}\n#tvpp .tvpp-wrapper {\n    position: relative;\n    padding-bottom: 56.25%;\n    left: -1px;\n}\n#tvpp .video-overlay {\n    width: 100%;\n    height: 100%;\n    position: absolute;\n    display: none;\n    background-repeat: no-repeat;\n    background-size: cover;\n}\n#tvpp .tvpp-holder {\n    top: 0;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    position: absolute;\n    width: 100%;\n    height: 100%;\n}\n#tvpp.no-products {\n    width: 100%;\n    float: none;\n}\n@media screen and (min-width: 768px) {\n    #tvpp {\n        float: left;\n        width: 83.5%;\n        overflow: hidden;\n    }\n}\n\n#tvpp-play {\n    width: 65px;\n    height: 37px;\n    background-color: #293D9E;\n    opacity: 0.7;\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    bottom: 0;\n    margin: auto;\n    border-radius: 1px;\n    z-index: 9;\n    cursor: pointer;\n}\n#tvpp-play:after {\n    content: " ";\n    width: 0;\n    height: 0;\n    border-top: 7px solid transparent;\n    border-bottom: 7px solid transparent;\n    border-left: 14px solid #fff;\n    position: absolute;\n    left: 0;\n    right: 0;\n    margin: auto;\n    top: 0;\n    bottom: 0;\n}\n#tvpp-play:hover {\n    opacity: 1;\n}\n\n@media screen and (min-width: 768px) {\n    #tvpprd {\n        height: 100%;\n        width: calc(13.85% - 4px);\n        position: absolute;\n        right: 10px;\n        top: 0;\n    }\n    #tvpprd #tvpprd-scroller {\n        height: 100%;\n        overflow: hidden;\n    }\n    #tvpprd #tvpprd-scroller .iScrollVerticalScrollbar {\n        position: absolute;\n        z-index: 9999;\n        width: 6px;\n        bottom: 2px;\n        top: 0;\n        right: -10px;\n    }\n    #tvpprd #tvpprd-scroller .iScrollIndicator {\n        cursor: pointer;\n        background-color: #c7c7c7;\n        box-sizing: border-box;\n        position: absolute;\n        border: 1px solid rgba(255, 255, 255, 0.90196);\n        width: 100%;\n        height: 391px;\n        -webkit-transform: translate(0px, 0px) translateZ(0px);\n                transform: translate(0px, 0px) translateZ(0px);\n        -webkit-transition-timing-function: cubic-bezier(0.1, 0.57, 0.1, 1);\n                transition-timing-function: cubic-bezier(0.1, 0.57, 0.1, 1);\n    }\n    #tvpprd #tvpprd-scroller .product {\n        position: relative;\n        display: block;\n        margin-bottom: 15px;\n    }\n    #tvpprd #tvpprd-scroller .product:before {\n        display: block;\n        content: "";\n        width: 100%;\n        padding-top: 100%;\n    }\n    #tvpprd #tvpprd-scroller .product .ar-content {\n        background-size: contain;\n        background-repeat: no-repeat;\n        background-position: center;\n        position: absolute;\n        top: 0;\n        left: 0;\n        right: 0;\n        bottom: 0;\n        color: #e8e8e8;\n        border: 1px solid #e8e8e8;\n    }\n    #tvpprd #tvpprd-scroller .product .product-overlay {\n        opacity: 0;\n        width: 100%;\n        height: 100%;\n        position: absolute;\n        top: 0;\n        left: 0;\n        background: rgba(0, 0, 0, 0.7);\n        z-index: 2;\n        -webkit-transition: opacity .25s ease-in-out;\n                transition: opacity .25s ease-in-out;\n    }\n    #tvpprd #tvpprd-scroller .product .product-overlay span {\n        display: block;\n        color: #FFF;\n        border-bottom: 1px solid #D32F36;\n        position: absolute;\n        top: 50%;\n        left: 50%;\n        -webkit-transform: translate(-50%, -50%);\n        transform: translate(-50%, -50%);\n        text-align: center;\n    }\n    #tvpprd #tvpprd-scroller .product:hover .product-overlay {\n        opacity: 1;\n    }\n}\n#tvpprd #tvpprd-slider {\n    min-height: 75px;\n    display: none;\n    background-color: #FFF;\n}\n#tvpprd #tvpprd-slider.slick-slider {\n    margin: 0px;\n}\n#tvpprd #tvpprd-slider.slick-slider .slick-dots {\n    position: relative;\n    bottom: 0;\n    padding-top: 0;\n    padding-bottom: 0;\n    margin: 0px;\n}\n#tvpprd #tvpprd-slider.slick-initialized {\n    display: block;\n}\n#tvpprd #tvpprd-slider .prd-item-graphic {\n    border: 1px solid #EAEAEA;\n}\n#tvpprd #tvpprd-slider .prd-item-call-t-action {\n    position: absolute;\n    bottom: 0;\n    right: 0;\n    color: #A4A4A4;\n    font-size: 9px;\n}\n#tvpprd #tvpprd-slider .prd-item-call-t-action .arrow-right {\n    content: "";\n    display: inline-block;\n    width: 6px;\n    height: 6px;\n    border-right: 2px solid #A4A4A4;\n    border-top: 2px solid #A4A4A4;\n    -webkit-transform: rotate(45deg);\n            transform: rotate(45deg);\n    margin-right: 5px;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating {\n    height: 13px;\n    font-size: 12px;\n    list-style: none;\n    margin: 0 0 0 15px;\n    padding: 0;\n    text-align: center;\n    float: left;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating li {\n    display: inline-block;\n    height: 20px;\n    height: 20px;\n    line-height: 20px;\n    margin: 0;\n    padding-right: 5px;\n    vertical-align: top;\n    color: #000;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating .star {\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAOCAMAAACb3vX5AAAAq1BMVEUAAAD/pyP/qif/qiv/qyb/qyf/qyj/rCfV1dX/qivV1dX/qivKysr/pyPNzc3/rSnOzs7/qybNzc3/qifNzc3/rCjNzc3/rCfMzMz/rCfMzMz/qyjMzMz/qyfMzMz/rCfMzMz/qybMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyfMzMz/qyf///8cpB0hAAAANnRSTlMAAAAAAAAAAAYGDAwdHTg4Q0NISE1NXFxubnNzd3fW1tvb4+Pn5+vr7u709PX19vb4+P39/v7CVzJLAAAA0klEQVR4AZXK11KEQBSE4VY8soJBV2XBLKsz5rCh5/3fTLqOI+Wd9k3XV/XjX5vNfqkpRzQNyh/O5/C5ehvR97DM05SO9VmcbmackFMzEXUXU4pdDWQxtFUhVG2gYCVwnb53C8DFYTdbwBU1wYCDpWfrI0DybnU4dPsLRYIB6Ly7hCapuzChVSVIuFf2CJ9EPpjjjhS8e1X3CZ9EfpjjhRS8W6YY0xo+KXBljgWDYGL9fg50z3vQpG20T7sbQvV2VtiAUt2OB/kKaBMdJkDh99d9AVonIyLyaQ9MAAAAAElFTkSuQmCC);\n    background-repeat: no-repeat;\n    width: 11px;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating .star-empty {\n    background-position: -28px 0;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating .star-full {\n    background-position: 0 0;\n}\n#tvpprd #tvpprd-slider .tvp-product-rating .star-half {\n    background-position: -15px 0;\n}\n#tvpprd .product-popup {\n    display: none;\n    position: absolute;\n    width: 245px;\n    padding: 8px;\n    z-index: 9999;\n    background-color: white;\n    box-shadow: 0 8px 30px -5px rgba(0, 0, 0, 0.35);\n    text-decoration: none;\n    border: 1px solid #e8e8e8;\n}\n#tvpprd .product-popup .pop-up-before {\n    display: none;\n    content: " ";\n    width: 0;\n    height: 0;\n    border-style: solid;\n    border-width: 13px 0 13px 13px;\n    border-color: transparent transparent transparent #FFF;\n    position: absolute;\n    top: 25px;\n    right: -12px;\n    margin-top: -5px;\n    z-index: 99999;\n}\n#tvpprd .product-popup .product-title{\n    text-align: center;\n    margin-top: 10px;\n    margin-bottom: 10px;\n    line-height: 0.85;\n    font-family: Arial,sans-serif;\n    font-size: 21px;\n    font-weight: 400;\n}\n#tvpprd .product-popup .product-title > a {\n    font-family: Arial,sans-serif;\n    text-align: center;\n    font-size: 14px;\n    color: #444444 !important;\n}\n#tvpprd .product-popup .product-price {\n    text-align: center;\n    font-size: 20px;\n    color: #273691;\n    font-family: Arial,sans-serif;\n    font-weight: bold;\n    margin: 15px 0 11px 0;\n}\n#tvpprd .product-popup .call-to-action {\n    display: block;\n    font-size: 17px;\n    padding: 0;\n    height: 40px;\n    text-align: center;\n    color: #273691;\n    font-family: FuturaStdMedium;\n    width: 100%;\n    border: none;\n    text-transform: uppercase;\n    background-color: #efefef;\n    border-bottom: 2px solid #dddddd;\n}\n#tvpprd .product-popup .call-to-action:hover {\n    background-color: #e0e0e0;\n}\n#tvpprd .product-popup .product-img {\n    position: relative;\n}\n#tvpprd .product-popup .product-img:before {\n    display: block;\n    content: "";\n    width: 100%;\n    padding-top: 95%;\n}\n#tvpprd .product-popup .product-img .ar-content {\n    background-size: cover;\n    background-repeat: no-repeat;\n    background-position: center;\n    position: absolute;\n    top: 0;\n    left: 0;\n    right: 0;\n    bottom: 0;\n}\n#tvpprd .product-popup .tvp-product-rating {\n    height: 24px;\n    font-size: 12px;\n    list-style: none;\n    margin: 0 0 10px;\n    padding: 0;\n    text-align: center;\n}\n#tvpprd .product-popup .tvp-product-rating li {\n    display: inline-block;\n    height: 20px;\n    line-height: 24px;\n    margin: 0;\n    vertical-align: top;\n    color: #444;\n}\n#tvpprd .product-popup .tvp-product-rating li:last-child {\n    margin-left: 10px;\n}\n#tvpprd .product-popup .tvp-product-rating .star {\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAABQCAMAAAAunqVFAAABv1BMVEUAAAD/6gD/////6gD/6gAAAAD/6gD/6gAAAAAAAAD/6gAAAAD/6gAAAAD/6gD/6gD/6gAAAAD/6gD/6gD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gD/6gD/6gD/6gD/6gD/6gD/6gAAAAD/6gD/6gAAAAD/6gAAAAAAAAD/6gAAAAAAAAD/6gAAAAD/6gAAAAD/6gD/6gD/6gAAAAD/6gD/6gD/6gD/6gAAAAD/6gD/6gAAAAAAAAD/6gD/6gD/6gAAAAAAAAD/6gD/6gD/6gAAAAD/6gAAAAD/6gAAAAAAAAAAAAD/6gAAAAD/6gD/6gD/6gAAAAAAAAAAAAD/6gD/6gD/6gAAAAD/6gD/6gD/6gD/6gD/6gD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gAAAAD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gD/6gAAAAAAAAAAAAAAAAAAAAAAAAD/6gAAAAD/6gD/6gD/6gD/6gD/6gAAAAAAAAD/6gD/6gAAAAAAAAAAAAD/6gAAAAD/6gAAAAD/6gD/6gAAAAD/6gAAAAD/6gAAAAAAAAD/6gAU0e3RAAAAk3RSTlMAAAABAgMDBAUHCAkJCgoREhYXGBkcHiUoKisrLC0uMzc7PDw9PkFDRERFRkZITU5SU1VWVldYWltgYWRlZ2hqbW5uc3R1d3h4f4SHiIuLjY+Qk5WZmpudnZ6foKOkpaWor7S2trm+w8XGx8nR0dLT1d7e3+Hi4+Tm5+jp6uvs7e7v8PDx8/T19vf4+vr7/Pz9/f67BYZ4AAAB60lEQVR42sXR11cTQRTH8RnABFCKgaAYWkCQomLBKCq9FwXpKIaioqKIRkUpCaCUEGq49w82lzCzZfYB5HD4Peyc/bzMnv0yLlZUxGkxkWk4Pq5ixt5ehoKdiJ1mTPQj+hNNWImRVWpoc2SVeGYIZzwlWQ5bBLv9aJq/m9n6zNhnY5w3G605elFFSKNQhbjdHRAWcGufNCFwgkuMXRa4HCvRhXIuiVX0OjxMzyqJI4jT7sh904gjEn2r9XY67fWrPoHpo2lENMdoOmGMOmv8r3Dh44bz+QJquMYGfGwOF0xNDX59eDMnza4LN8T5gCHcy+q77hTOU67fq3mF2B8Nt5jHj5Y7j60iXPBO1G4HQw+0cGEXnVfDSwW6cDvJdFzafqsP94lzj4fzqb9xunBdmZOIk5nPMVsXbmqHwm1/wGqrcK+twn23Dnc+jdCqEVo0QlQa0QyNBBobCTQ1EmhsRKg0IlQaESqNaEojxDNtdGJktFvv1mG2x8mYDl8A/Pq8ASuFOqyFHzcYS2rbX3FKvPhn8wqjtUGvxFIYZIdL2piV+ATqWHRfQOJ9aD/CuTWJzoNvCYdWBm8ksvcwRnrtNxRLbAGAn8+avFvQwQSSfdwFgIWnTCBZC7tc/ig/nkn0kokJvOAlEzv9T/4H4BEA82AwTEoAAAAASUVORK5CYII=);\n    background-repeat: no-repeat;\n    width: 19px;\n}\n#tvpprd .product-popup .tvp-product-rating .star-empty {\n    background-position: 0 -20px;\n}\n#tvpprd .product-popup .tvp-product-rating .star-full {\n    background-position: 0 0;\n}\n#tvpprd .product-popup .tvp-product-rating .star-half {\n    background-position: 0 -41px;\n}\n#tvpprd .prd-item {\n    display: block;\n    background-color: white;\n    height: 75px;\n    margin: 8px 4px;\n    border-radius: 1px;\n    border: 1px solid #DDD;\n    position: relative;\n}\n#tvpprd .prd-item:after {\n    content: "";\n    display: table;\n    clear: both;\n}\n#tvpprd .prd-item.hovered {\n    background-color: #EEE;\n}\n#tvpprd .prd-item-graphic {\n    float: left;\n    width: 60px;\n    position: relative;\n    top: 50%;\n    -webkit-transform: translateY(-50%);\n    transform: translateY(-50%);\n    left: 5px;\n}\n#tvpprd .prd-item-graphic > div {\n    background-size: cover;\n    background-repeat: no-repeat;\n    background-position: center center;\n    padding-top: 100%;\n}\n#tvpprd .prd-item-text {\n    float: right;\n    width: calc(100% - 80px);\n    position: relative;\n    top: 50%;\n    -webkit-transform: translateY(-50%);\n    transform: translateY(-50%);\n    right: 5px;\n}\n#tvpprd .bottom-description {\n    font-size: 10px;\n    letter-spacing: 1px;\n    margin-top: 5px;\n}\n#tvpprd .prd-item-title {\n    margin: 10px 0 0 0;\n    font-size: 12px;\n    min-height: 36px;\n    max-height: 36px;\n    overflow: hidden;\n    color: #323232;\n    font-weight: normal;\n    font-family: FuturaStdLight,sans-serif;\n}\n@media screen and (max-width: 767px) {\n    #tvpprd .prd-item-title {\n        margin: 0;\n        white-space: nowrap;\n        text-overflow: ellipsis;\n        min-height: initial;\n    }\n}\n@media screen and (max-height: 389px) {\n    #tvpprd .prd-item-title {\n        margin: 0;\n        white-space: nowrap;\n        text-overflow: ellipsis;\n        min-height: initial;\n    }\n}\n#tvpprd .prd-item-price {\n    margin: 0;\n    color: #000;\n    font-size: 16px;\n    float: left;\n    font-weight: bold;\n}\n\n.slick-dots {\n    display: block;\n    position: relative;\n    text-align: center;\n    list-style: none;\n    padding-top: 2px;\n    padding-bottom: 8px;\n}\n.slick-dots > li {\n    display: inline-block;\n    margin-right: 4px;\n}\n.slick-dots > li button {\n    width: 13px;\n    height: 14px;\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAsCAYAAAC+GzLvAAAD0UlEQVR42sRVTWhcVRS+f/PmpzPzZiK4ETfWjQqlNNhSiFRcFGGoIW4qLZJg/UMpunDRGKQLfxItimAtIWYj0oUbkRHMgFCMASOKUBCFqrUIIhFqESaZmbz77r1+5743cWomnVEXHjjcd8893/l555x7uXOOdWl2dvYWLM+AR1O+BP4SvDA9Pf1NV493QXNzc8eEEOeklCGY4ZvRmTGGxXEcWWvPYH8aYKNSwIlMJrOYz+cZcRAEjIBQZFEUsU6nE7RarRmtdQj1kzKXy41ks9mPy+VyrlKpsFKpxAqFAoOcQb61kmd43b+8vLyk4OEoFMNqteq90GEvkUellF855+R9SsHSQbLeD9AlkpNHyg+hjglswq77GxF5oVxhvCgQ3hq5HoZIj/QFLDTIyjBEeoioIZBYHXxxGBDqtI68zorJyUms5jgE1wZgDIp8HHTNZz8xMfEdgAfSlulHV3B+eHx8vH5dG3VpaWnpEGKv4ZOqH4E/AaBRq9Wibb33T0iwf0Gqd1N66w8/GiIjRrlgowjiko0c8nQLzZOV7aNRevP3YzIvz8mAh1xyKgr9ZOYMYzayUdwyZyA43Xz2pmQ0Sm/8dkLtkosyaxkXaaHTVOGR8SwLYGNGN2M/Grz46i8jMid/UgUZ8htlCCNxGwPZMgcUxvKo4C7kxqJ8A/4ad1TiKcVjfZDHFMvg/uPWMeHMmAIy9CA3RNNCjcemqFy0ueYixbgaAgRPLjJrikW64Tr2cRYMrrPTjtl23FBM67rZiC8KK/f6+uwEoP/UMetM27O+uKWnV+6UGbGismKkH9AhLBM5E2+aB5tv31P/qyOe/PR2Ifl5GYj9vsBJQySA2F2x2j7anL/3Qt8uLz124RCWGjogxJEfDXCj+c59/8No/Pd5+mjm8s3I5SF83pHyz+BvkcEHR17e/eO2nAC4H8spcLGbZs91qMHvQT7/wCu7rfdUf/7yOJYX/NC53ntuC5jB1yOQFPH9Gv/w1A9lwpGH9EK8vrMZ//sATCooHcZBAmCuT2O7pLtTJPZHAGJ7UumAqdgKfa9CmxQTAGc7vgOJsyR0xwrKWneVlOl5cjsAXdq0NgFdxavhVo2hV9x5Sz6EHqa9pabFHWITnVV6apY31je/73Q0upkOrFciq8Z3uGWxNqy1gVe+rVsQv++LO//w17e1W9FiJpDlwi560ZW//7xyS7M2APRGh9XCc1MLez7b6ojXJz6/FdZewvYuKYW/JK1JwlIZ+Wt1JP/iU+fv/qrvaMzWVvbpyIxBXgQ4zubUF+VKfvWJd/fprs6fAgwAlv8CCnsWGMoAAAAASUVORK5CYII=);\n    background-color: transparent;\n    background-position: 0px 0px;\n    background-repeat: no-repeat;\n    color: transparent;\n}\n.slick-dots > li button:before {\n    content: "";\n    color: transparent;\n}\n.slick-dots > li button:hover {\n    background-position: 0px -15px;\n}\n.slick-dots > li.slick-active > button {\n    background-position: 0px -15px;\n    background-color: transparent;\n    color: transparent;\n}';});

define('index',['require','text!static/js-css.css'],function(require) {

  require('text!static/js-css.css');

});
