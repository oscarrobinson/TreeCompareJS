TreeCompare = (function() {

    var trees = [];
    var renderedTrees = [];


    var rerootToClosestMatchEnabled = true;
    var manualReroot = false;

    var scaleLineWidth = 0;
    var scaleLinePadding = 10;

    var colorScaleRange = ['rgb(254,240,217)', 'rgb(253,212,158)', 'rgb(253,187,132)', 'rgb(252,141,89)', 'rgb(227,74,51)', 'rgb(179,0,0)'];
    var colorScaleDomain = [1, 0.8, 0.6, 0.4, 0.2, 0];


    var scaleTextColor = "white";


    var defaultLineColor = "#999";

    //leaf or element
    var currentS = "leafS";
    var currentBCN = "leafBCN";
    //set externally by comparison metric
    var comparisonMetric = "leafBased";

    function setComparisonMetric(metric) {
        if (metric === "leafBased") {
            currentS = "leafS";
            currentBCN = "leafBCN";
        } else if (metric === "elementBased") {
            currentS = "elementS";
            currentBCN = "elementBCN";
        }
        updateAllRenderedTrees();
    }


    var highlightedNodes = [];
    var maxHighlightedNodes = 20;

    var settings = {
        useLengths: true,
        fontSize: 14,
        lineThickness: 3,
        nodeSize: 3,
        treeWidth: 500,
        treeHeight: 15,
        moveOnClick: true,
        enableZoomSliders: true,
        scaleMin: 0.05,
        scaleMax: 5,
        clickAction: "reroot", //reroot, highlight, collapse
        scaleColor: "black",
        loadingCallback: function() {},
        loadedCallback: function() {},
        internalLabels: "none", //none, name, length, similarity
        enableDownloadButtons: true,
        enableFisheyeZoom: false
    }


    function init(settingsIn) {
        var settingsIn = settingsIn ? settingsIn : {};
        changeSettings(settingsIn);
        return this;
    }


    function resize() {
        for (var i = 0; i < renderedTrees.length; i++) {
            var data = renderedTrees[i].data;
            $("#" + data.canvasId + " svg").width($("#" + data.canvasId).width());
            $("#" + data.canvasId + " svg").height($("#" + data.canvasId).height());
        }

    }

    window.onresize = resize;

    function changeSettings(settingsIn) {
        settings.useLengths = (!(settingsIn.useLengths === undefined)) ? settingsIn.useLengths : settings.useLengths;
        settings.fontSize = (!(settingsIn.fontSize === undefined)) ? settingsIn.fontSize : settings.fontSize;
        settings.lineThickness = (!(settingsIn.lineThickness === undefined)) ? settingsIn.lineThickness : settings.lineThickness;
        settings.nodeSize = (!(settingsIn.nodeSize === undefined)) ? settingsIn.nodeSize : settings.nodeSize;
        settings.treeWidth = (!(settingsIn.treeWidth === undefined)) ? settingsIn.treeWidth : settings.treeWidth;
        settings.treeHeight = (!(settingsIn.treeHeight === undefined)) ? settingsIn.treeHeight : settings.treeHeight;
        settings.moveOnClick = (!(settingsIn.moveOnClick === undefined)) ? settingsIn.moveOnClick : settings.moveOnClick;
        settings.enableZoomSliders = (!(settingsIn.enableZoomSliders === undefined)) ? settingsIn.enableZoomSliders : settings.enableZoomSliders;
        settings.scaleMin = (!(settingsIn.scaleMin === undefined)) ? settingsIn.scaleMin : settings.scaleMin;
        settings.scaleMax = (!(settingsIn.scaleMax === undefined)) ? settingsIn.scaleMax : settings.scaleMax;
        settings.clickAction = (!(settingsIn.clickAction === undefined)) ? settingsIn.clickAction : settings.clickAction;
        settings.scaleColor = (!(settingsIn.scaleColor === undefined)) ? settingsIn.scaleColor : settings.scaleColor;
        settings.loadingCallback = (!(settingsIn.loadingCallback === undefined)) ? settingsIn.loadingCallback : settings.loadingCallback;
        settings.loadedCallback = (!(settingsIn.loadedCallback === undefined)) ? settingsIn.loadedCallback : settings.loadedCallback;
        settings.internalLabels = (!(settingsIn.internalLabels === undefined)) ? settingsIn.internalLabels : settings.internalLabels;
        settings.enableDownloadButtons = (!(settingsIn.enableDownloadButtons === undefined)) ? settingsIn.enableDownloadButtons : settings.enableDownloadButtons;
        settings.enableFisheyeZoom = (!(settingsIn.enableFisheyeZoom === undefined)) ? settingsIn.enableFisheyeZoom : settings.enableFisheyeZoom;
        updateAllRenderedTrees();
    }

    function updateAllRenderedTrees() {
        for (var i = 0; i < renderedTrees.length; i++) {
            update(renderedTrees[i].data.root, renderedTrees[i].data);
        }
    }

    function prepareNetworkJSON() {
        var treesIncluded = {};
        for (var i = 0; i < trees.length; i++) {
            treesIncluded[trees[i].name] = false;
        }
        var groups = [];
        var group = 0;
        for (var i = 0; i < trees.length; i++) {
            if (treesIncluded[trees[i].name] === false) {
                groups.push([trees[i].name]);
                treesIncluded[trees[i].name] = true;
                var sims = _.keys(trees[i].similarities);
                for (var j = 0; j < sims.length; j++) {
                    if (trees[i].similarities[sims[j]] > 0) {
                        groups[group].push(sims[j]);
                        treesIncluded[sims[j]] = true;
                    }
                }
                group += 1;
            }
        }

        var nodes = [];
        for (var i = 0; i < groups.length; i++) {
            for (var j = 0; j < groups[i].length; j++) {
                nodes.push({
                    name: groups[i][j],
                    group: i + 1
                });
            }
        }
        var links = [];
        var linksDone = 0;
        for (var i = 0; i < groups.length; i++) {
            for (var j = 0; j < groups[i].length; j++) {
                for (var k = (j + 1); k < groups[i].length; k++) {
                    var tree = _.find(trees, function(tree) {
                        return tree.name === nodes[j + linksDone].name;
                    });
                    var otherTree = _.find(trees, function(tree) {
                        return tree.name === nodes[k + linksDone].name;
                    });
                    links.push({
                        source: j + linksDone,
                        target: k + linksDone,
                        weight: 1 / tree.similarities[otherTree.name]
                    })
                }
            }
            linksDone += (groups[i].length);
        }

        var finalObj = {
            nodes: nodes,
            links: links
        };
        return JSON.stringify(finalObj);
    }

    function addTree(newick, name) {
        try {
            var tree = convertTree(newick);
        } catch (err) {
            throw "Invalid Newick";
        }
        for (var i = 0; i < trees.length; i++) {
            if (name === trees[i].name) {
                throw "Tree With Name Already Exists"
            }
        }
        postorderTraverse(tree, function(d) {
            d.leaves = getChildLeaves(d);
            d.highlight = 0;
        });
        var similarities = getSimilarities(tree, name);
        var fullTree = {
            root: tree,
            name: name,
            data: {},
            similarities: similarities
        };

        for (var i = 0; i < trees.length; i++) {
            trees[i].similarities[name] = getSimilarity(trees[i].root, tree);
        }

        trees.push(fullTree);
        return fullTree;
    }

    function getTrees() {
        return trees
    }


    function removeTree(name) {
        trees.splice(findTreeIndex(name), 1);
        for (var i = 0; i < renderedTrees.length; i++) {
            if (renderedTrees[i].name === name) {
                $("#" + renderedTrees[i].data.canvasId).empty();
                if (renderedTrees[i].data.scaleId) {
                    $(renderedTrees[i].data.scaleId).empty();
                }
            }
        }
        for (var i = 0; i < trees.length; i++) {
            delete trees[i].similarities[name];
        }
    }

    function getSimilarities(t, name) {
        similarities = {};
        for (var i = 0; i < trees.length; i++) {
            var nameOther = trees[i].name;
            if (nameOther !== name) {
                similarities[nameOther] = getSimilarity(t, trees[i].root);
            }
        }
        return similarities;
    }

    function getSimilarity(tree1, tree2) {
        for (var i = 0; i < tree1.leaves.length; i++) {
            for (var j = 0; j < tree2.leaves.length; j++) {
                if (tree1.leaves[i].name === tree2.leaves[j].name) {
                    tree1.leaves[i].correspondingLeaf = tree2.leaves[j];
                    tree2.leaves[j].correspondingLeaf = tree1.leaves[i];
                }
            }
        }

        postorderTraverse(tree1, function(d) {
            d.deepLeafList = createDeepLeafList(d);
        });
        postorderTraverse(tree2, function(d) {
            d.deepLeafList = createDeepLeafList(d);
        });

        return getElementS(tree1, tree2);
    }


    function renderColorScale(scaleId) {
        var colorScale = d3.scale.linear()
            .domain(colorScaleDomain)
            .range(colorScaleRange);
        var width = 200;
        var steps = 100;
        var height = 30;
        var svgHeight = height + 25;
        var svg = d3.select("#" + scaleId).append("svg")
            .attr("width", width + "px")
            .attr("height", svgHeight + "px")
            .append("g")
        for (var i = 0; i < steps; i++) {
            svg.append("rect")
                .attr("width", (width / steps) + "px")
                .attr("height", height + "px")
                .attr("fill", colorScale(i / steps))
                .attr("x", ((width / steps) * i) + "px")
        }
        svg.append("text")
            .text("0")
            .attr("x", 0)
            .attr("y", height + 20)
            .attr("fill", settings.scaleColor)
        svg.append("text")
            .text("1")
            .attr("x", width - 10)
            .attr("y", height + 20)
            .attr("fill", settings.scaleColor)

    }


    function getChildren(d) {
        return d._children ? d._children : (d.children ? d.children : []);
    }

    function reroot(tree, newRoot) {
        var children = getChildren(newRoot);
        if (children.length < 1) {
            return tree;
        }
        if (!newRoot.parent) {
            return newRoot;
        } else {
            newRoot.children.push(reroot(tree, newRoot.parent));
            var i = newRoot.parent.children.indexOf(newRoot);
            if (i > -1) {
                newRoot.parent.children.splice(i, 1);
            }
            newRoot.parent.length = newRoot.length;
            newRoot.parent = null;
            return newRoot;
        }

    }

    function postRerootClean(root, name) {
        highlightedNodes = [];
        postorderTraverse(root, function(d) {
            d.bcnhighlight = null;
            d.highlight = 0;
            d.clickedHighlight = null;
            d.leaves = getChildLeaves(d);
        });
        if (name) {
            for (var i = 0; i < trees.length; i++) {
                if (trees[i].name !== name) {
                    trees[i].similarities[name] = getSimilarity(trees[i].root, root);
                } else {
                    trees[i].similarities = getSimilarities(trees[i].root, name);
                }
            }
        }

    }

    function applyScaleText(scaleText, zoomScale, root) {
        if (root.children || root._children) {
            var children = getChildren(root);
            var length = 0;
            var offset = 0;
            for (var i = 0; i < children.length; i++) {
                length = getLength(children[i]);
                offset = children[i].y
                if (length != 0 && offset != 0) {
                    break;
                }
            }
            var text = ((scaleLineWidth / offset) * length) / zoomScale;
            scaleText.text(text);
        }
    }


    //returns number of leaf nodes that are children of d (includes self if self is leaf)
    function getTotalChildLeaves(d) {
        if (d.children || d._children) {
            total = 0;
            var children = getChildren(d);
            for (var i = 0; i < children.length; i++) {
                total = total + getTotalChildLeaves(children[i]);
            }
            return total;
        } else {
            return 1;
        }
    }

    //returns list of leaf nodes that are children of d
    function getChildLeaves(d) {
        if (d.children || d._children) {
            leaves = [];
            var children = getChildren(d);
            for (var i = 0; i < children.length; i++) {
                leaves = leaves.concat(getChildLeaves(children[i]));
            }
            return leaves;
        } else {
            return [d];
        }
    }

    function addParents(d) {
        var children = getChildren(d);
        for (var i = 0; i < children.length; i++) {
            children[i].parent = d;
            addParents(children[i]);
        }
    }



    //returns longest length between two nodes of all nodes in subtree rooted at root
    function getMaxLength(root) {
        var max = 0;

        function getMax_internal(d, max) {
            if (d.children || d._children) {
                var children = getChildren(d);
                for (var i = 0; i < children.length; i++) {
                    max = Math.max(getMax_internal(children[i], max), max)
                }
                return max;
            } else {
                return (d.length ? Math.max(d.length, max) : max)
            }
        }
        return getMax_internal(root, max);
    }

    //get total length of a node from root
    function getLength(d) {
        if (d.parent) {
            return d.length + getLength(d.parent);
        } else {
            return 0;
        }
    }



    //traverses and performs function on treenodes in postorder
    function postorderTraverse(d, f) {
        var children = getChildren(d);
        if (children.length > 0) {
            for (var i = 0; i < children.length; i++) {
                postorderTraverse(children[i], f);
            }
            f(d);
            return;
        } else {
            f(d);
            return;
        }
    }



    function update(source, treeData) {

        var duration = 750;

        var colorScale = d3.scale.linear()
            .domain(colorScaleDomain)
            .range(colorScaleRange);

        // Compute the new tree layout.
        var nodes = treeData.tree.nodes(treeData.root).reverse()
        var links = treeData.tree.links(nodes);

        var leaves = treeData.root.leaves.length;
        var leafHeight = settings.treeHeight;
        var height = leaves * leafHeight;

        var center = (leaves / 2) * leafHeight;

        function setXPos(d, upperBound) {
            if (d.depth == 0) {
                d.x = center;
                d.baseX = d.x;
                var children = getChildren(d);
                var numLeavesAlready = 0;
                for (var i = 0; i < children.length; i++) {
                    var totalChildren = children[i].leaves.length;
                    setXPos(children[i], upperBound);
                    numLeavesAlready += totalChildren;
                    upperBound = (numLeavesAlready * leafHeight);
                }
            } else {
                var totalChildren = d.leaves.length;
                d.x = ((totalChildren * leafHeight) / 2) + upperBound;
                d.baseX = d.x;
                var children = getChildren(d);
                var numLeavesAlready = 0;
                for (var i = 0; i < children.length; i++) {
                    var totalChildren = children[i].leaves.length;
                    setXPos(children[i], upperBound);
                    numLeavesAlready += totalChildren;
                    upperBound += (numLeavesAlready * leafHeight);
                }
            }
        }

        var maxLength = getMaxLength(treeData.root);
        var lengthMult = settings.treeWidth;

        nodes.forEach(function(d) {
            if (settings.useLengths) {
                d.y = getLength(d) * (lengthMult / maxLength);
                d.baseY = d.y;
            } else {
                d.y = d.depth * lengthMult / 10;
                d.baseY = d.y;
            }
        });

        setXPos(treeData.root, 0);


        // Update the nodes…
        var node = treeData.svg.selectAll("g.node")
            .data(nodes, function(d) {
                return d.id || (d.id = ++treeData.i);
            });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", function(d) {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .style("cursor", "pointer")
            .on("mouseover", nodeMouseover)
            .on("mouseout", nodeMouseout)
            .on("click", treeData.clickEvent)


        nodeEnter.append("circle")
            .attr("r", settings.nodeSize)
            .style("fill", function(d) {
                if (d.bcnhighlight) {
                    return d.bcnhighlight;
                } else if (d[currentS] && d.highlight < 1) {
                    return colorScale(d[currentS])
                } else {
                    return (d.highlight > 0) ? "green" : d._children ? "orange" : "black";
                }
            });

        nodeEnter.append("rect")
            .attr("y", "-5px")
            .attr("x", "-5px")
            .attr("width", "0px")
            .attr("height", "0px")
            .style("fill", "magenta")
            .style("stroke-width", "2px")
            .style("stroke", "black");

        nodeEnter.append("text")
            .attr("x", function(d) {
                return d.children || d._children ? -13 : 13;
            })
            .attr("dy", ".35em")
            .attr("text-anchor", function(d) {
                return d.children || d._children ? "end" : "start";
            })
            .style("fill-opacity", 1e-6)
            .attr("font-size", function(d) {
                return settings.fontSize + "px"
            })
            .style("font-family", "sans-serif");

        //instant node changes
        node.select("text")
            .style("font-weight", function(d) {
                return (d.highlight > 0) ? "bold" : "normal";
            })
            .style("fill", function(d) {
                return (d.highlight > 0) ? "green" : "black";
            })
            .attr("font-size", function(d) {
                return settings.fontSize + "px"
            });

        node.select("circle")
            .attr("r", function(d) {
                if (d.bcnhighlight) {
                    return (settings.nodeSize * 1.5);
                }
                return settings.nodeSize;
            })
            .style("fill", function(d) {
                if (d.bcnhighlight) {
                    return d.bcnhighlight;
                } else if (d[currentS] && d.highlight < 1) {
                    return colorScale(d[currentS])
                } else {
                    return (d.highlight > 0) ? "green" : d._children ? "orange" : "black";
                }
            })
            .style("stroke", "black")
            .style("stroke-width", 1);


        node.select("rect")
            .attr("width", function(d) {
                if (d.clickedHighlight) {
                    return (settings.nodeSize * 2) + "px";
                } else {
                    return "0px";
                }
            })
            .attr("height", function(d) {
                if (d.clickedHighlight) {
                    return (settings.nodeSize * 2) + "px";
                } else {
                    return "0px";
                }
            })
            .style("fill", function(d) {
                if (d.clickedHighlight) {
                    return d.clickedHighlight;
                }
            })
            .attr("y", -settings.nodeSize + "px")
            .attr("x", -settings.nodeSize + "px");


        // Node changes with transition
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + d.y + "," + d.x + ")";
            });


        nodeUpdate.select("text")
            .style("fill-opacity", 1)
            .text(function(d) {
                if (!d.children && !d._children) {
                    return d.name
                } else {
                    if (settings.internalLabels === "none") {
                        return "";
                    } else if (settings.internalLabels === "name") {
                        return d.name
                    } else if (settings.internalLabels === "length") {
                        if (d.length) {
                            return d.length.toFixed(3);
                        }
                    } else if (settings.internalLabels === "similarity") {
                        if (d[currentS]) {
                            return d[currentS].toFixed(3);
                        }
                    }

                }
            });

        // Transition exiting nodes to the parent"s new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6)
            .attr("stroke", "none");

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);


        function renderLinks(type) {
            // Update the links…
            var select = (type === "bg") ? "linkbg" : "link";
            var link = treeData.svg.selectAll("path." + select)
                .data(links, function(d) {
                    return d.target.id;
                })
                .style("stroke", function(d) {
                    if (type === "front") {
                        var d = d.source;
                        if (d[currentS] && d.highlight < 1) {
                            return colorScale(d[currentS])
                        } else {
                            return (d.highlight > 0) ? "green" : defaultLineColor;
                        }
                    } else if (type === "bg") {
                        return "black"
                    }
                });

            // Enter any new links at the parent"s previous position.
            link.enter().insert("path", "g")
                .attr("class", function(d) {
                    if (type === "bg") {
                        return "linkbg";
                    } else {
                        return "link";
                    }
                })
                .attr("d", function(d) {
                    return "M" + source.y0 + "," + source.x0 + "L" + source.y0 + "," + source.x0 + "L" + source.y0 + "," + source.x0;

                })
                .style("fill", "none")
                .style("stroke-width", function() {
                    if (type === "bg") {
                        return (parseInt(settings.lineThickness) + 2);
                    } else if (type === "front") {
                        return settings.lineThickness
                    }
                })
                .style("stroke", function(d) {
                    if (type === "front") {
                        var d = d.source;
                        if (d[currentS] && d.highlight < 1) {
                            return colorScale(d[currentS])
                        } else {
                            return (d.highlight > 0) ? "green" : defaultLineColor;
                        }
                    } else if (type === "bg") {
                        return "black"
                    }
                });

            // Transition links to their new position.
            link.transition()
                .duration(duration)
                .style("stroke-width", function() {
                    if (type === "bg") {
                        return (parseInt(settings.lineThickness) + 2);
                    } else if (type === "front") {
                        return settings.lineThickness
                    }
                })
                .attr("d", function(d) {
                    return "M" + d.source.y + "," + d.source.x + "L" + d.source.y + "," + d.target.x + "L" + d.target.y + "," + d.target.x;
                });


            // Transition exiting nodes to the parent"s new position.
            link.exit().transition()
                .duration(duration)
                .attr("d", function(d) {
                    return "M" + source.y + "," + source.x + "L" + source.y + "," + source.x + "L" + source.y + "," + source.x;
                })
                .remove();

        }

        renderLinks("bg");
        renderLinks("front");


        // Stash the old positions for transition.
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        //wait for transition before generating download
        if (settings.enableDownloadButtons) {
            setTimeout(function() {
                updateDownloadLinkContent(treeData.canvasId)
            }, duration);
        }

        applyScaleText(treeData.scaleText, treeData.zoomBehaviour.scale(), treeData.root);

        function nodeMouseover(d) {
            function colorLink(n) {
                if (n.children) {
                    for (var i = 0; i < n.children.length; i++) {
                        colorLink(n.children[i]);
                    }
                }
                if (!settings.enableFisheyeZoom) {
                    n.highlight += 1;
                }
            }
            colorLink(d);
            if (!settings.enableFisheyeZoom) {
                update(d, treeData);
            }
        }

        function nodeMouseout(d) {
            function colorLink(n) {
                if (n.children) {
                    for (var i = 0; i < n.children.length; i++) {
                        colorLink(n.children[i]);
                    }
                }
                if (!settings.enableFisheyeZoom) {
                    n.highlight -= 1;
                }
            }

            colorLink(d);
            if (!settings.enableFisheyeZoom) {
                update(d, treeData);
            }
        }
    }



    function applyEventListeners(treeData) {
        $("#zoomSlider" + treeData.id).on("input change", function() {
            treeData.zoomBehaviour.scale($("#zoomSlider" + treeData.id).val());
            treeData.zoomBehaviour.event(treeData.svg);
        });
    }

    function updateDownloadLinkContent(canvasId) {
        $("#downloadButtons" + canvasId).empty();
        var html = d3.select("#" + canvasId + " svg")
            .attr("version", 1.1)
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .node().parentNode.children[1].outerHTML;
        d3.select("#downloadButtons" + canvasId).append("a")
            .attr("title", "file.svg")
            .attr("href-lang", "image/svg+xml")
            .attr("href", "data:image/svg+xml;base64,\n" + btoa(html))
            .text("Download As SVG")
            .attr("download", "PhyloIO_Tree");
        $("#downloadButtons" + canvasId + " a").css({
            "color": "#999"
        });
    }


    function renderTree(name, canvasId, scaleId) {
        //check if something was already rendered in this canvas, if so remove it from rendered list
        var x = -1;
        for (var i = 0; i < renderedTrees.length; i++) {
            if (renderedTrees[i].data.canvasId === canvasId) {
                x = i;
                break;
            }
        }
        if (x != -1) {
            renderedTrees.splice(x, 1);
        }

        renderedTrees.push(trees[findTreeIndex(name)]);


        $("#" + canvasId).empty();
        $("#" + scaleId).empty();
        scaleId = "#" + scaleId;


        if (settings.enableZoomSliders) {
            $("#" + canvasId).append('<div class="zoomSliderContainer">Zoom: <input type="range" class="zoomSlider" id="zoomSlider' + findTreeIndex(name) + '" min="0.05" max="5" value="1.00" step="0.01"></input></div>');
            $(".zoomSliderContainer").css({
                "position": "absolute",
                "color": "black",
                "margin-left": "5px",
                "margin-top": "5px"
            });
        }



        var i = 0;

        var width = $("#" + canvasId).width();
        var height = $("#" + canvasId).height();


        var tree = d3.layout.tree()
            .size([height, width])

        var diagonal = d3.svg.diagonal()
            .projection(function(d) {
                return [d.y, d.x];
            });

        var svg = d3.select("#" + canvasId).append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g");

        if (settings.enableDownloadButtons) {
            $("#" + canvasId).append('<div id="downloadButtons' + canvasId + '"></div>');
            $("#downloadButtons" + canvasId).css({
                "margin-left": "2px",
                "bottom": "5px",
                "position": "absolute",

            });
        }

        var zoomBehaviour = d3.behavior.zoom()
            .scaleExtent([settings.scaleMin, settings.scaleMax])
            .on("zoom", zoom)

        $(".zoomSlider").attr("min", settings.scaleMin);
        $(".zoomSlider").attr("max", settings.scaleMax);

        d3.select("#" + canvasId + " svg")
            .call(zoomBehaviour);

        var root = trees[findTreeIndex(name)].root;
        root.x0 = height / 2;
        root.y0 = 0;


        if (scaleId) {
            var scaleSvg = d3.select(scaleId).append("svg")
                .attr("width", $(scaleId).width())
                .attr("height", $(scaleId).height())
                .append("g")
                //draw scale line
            d3.select(scaleId + " svg").append("path")
                .attr("d", function() {
                    var width = parseFloat(d3.select(scaleId + " svg").style("width"));
                    scaleLineWidth = width * 0.75;
                    return "M" + scaleLinePadding + ",20L" + (scaleLineWidth + scaleLinePadding) + ",20"
                })
                .attr("stroke-width", 1)
                .attr("stroke", settings.scaleColor);
            var scaleText = d3.select(scaleId + " svg").append("text")
                .attr("x", scaleLineWidth / 2 + scaleLinePadding)
                .attr("y", 35)
                .attr("font-family", "sans-serif")
                .text("0")
                .attr("font-size", "14px")
                .attr("fill", settings.scaleColor)
                .attr("text-anchor", "middle");
            jQuery.extend(trees[findTreeIndex(name)].data, {
                scaleText: scaleText
            });
        }

        jQuery.extend(trees[findTreeIndex(name)].data, {
            canvasId: canvasId,
            root: root,
            tree: tree,
            svg: svg,
            i: i,
            id: findTreeIndex(name),
            zoomBehaviour: zoomBehaviour,
            scaleId: scaleId
        });
        postorderTraverse(trees[findTreeIndex(name)].data.root, function(d) {
            d.leaves = getChildLeaves(d);
            d.highlight = 0;
        });


        applyEventListeners(trees[findTreeIndex(name)].data);
        update(trees[findTreeIndex(name)].root, trees[findTreeIndex(name)].data);


        getFisheye();



        d3.select("#" + canvasId).on("mousemove", function() {
            if (settings.enableFisheyeZoom) {
                var link = svg.selectAll("path.link");
                var linkbg = svg.selectAll("path.linkbg");
                var node = svg.selectAll("g.node");
                var scale = zoomBehaviour.scale();

                var fisheye = d3.fisheye.circular()
                    .radius(200 / (scale * 3))
                    .distortion(5 / (scale / 0.9));

                var mousePos = [(d3.mouse(this)[1] - zoomBehaviour.translate()[1]) / scale, (d3.mouse(this)[0] - zoomBehaviour.translate()[0]) / scale];
                fisheye.focus(mousePos);
                //console.log(d3.mouse(this));

                node.each(function(d) {
                    d.fisheye = fisheye(d);
                });

                node.select("circle")
                    .attr("r", function(d) {
                        return d.fisheye.z * settings.nodeSize;
                    })
                    .attr("cy", function(d) {
                        return d.fisheye.x - d.x;
                    })
                    .attr("cx", function(d) {
                        return d.fisheye.y - d.y;
                    });

                node.select("rect")
                    .attr("width", function(d) {
                        if (d.clickedHighlight) {
                            return d.fisheye.z * settings.nodeSize * 2;
                        }
                    })
                    .attr("height", function(d) {
                        if (d.clickedHighlight) {
                            return d.fisheye.z * settings.nodeSize * 2;
                        }
                    })
                    .attr("y", function(d) {
                        return d.fisheye.x - d.x - (d.fisheye.z * settings.nodeSize);
                    })
                    .attr("x", function(d) {
                        return d.fisheye.y - d.y - (d.fisheye.z * settings.nodeSize);
                    });

                node.select("text")
                    .attr("font-size", function(d) {
                        if (d3.select(this).attr("font-size")) {
                            var mult = (d.fisheye.z / 2) > 1 ? (d.fisheye.z / 2) : 1;
                            return settings.fontSize * mult;
                        }
                    })
                    .attr("y", function(d) {
                        return d.fisheye.x - d.x;

                    })
                    .attr("x", function(d) {
                        return d.fisheye.y - d.y + (d.fisheye.z * 10);

                    });

                link.style("stroke-width", function(d) {
                        return Math.max(settings.lineThickness * (d.source.fisheye.z), settings.lineThickness * (d.target.fisheye.z));
                    })
                    .attr("d", function(d) {
                        return "M" + d.source.fisheye.y + "," + d.source.fisheye.x + "L" + d.source.fisheye.y + "," + d.target.fisheye.x + "L" + d.target.fisheye.y + "," + d.target.fisheye.x;
                    });

                linkbg.style("stroke-width", function(d) {
                        return Math.max(settings.lineThickness * (d.source.fisheye.z), settings.lineThickness * (d.target.fisheye.z)) + 2;
                    })
                    .attr("d", function(d) {
                        return "M" + d.source.fisheye.y + "," + d.source.fisheye.x + "L" + d.source.fisheye.y + "," + d.target.fisheye.x + "L" + d.target.fisheye.y + "," + d.target.fisheye.x;
                    });
            }
        });

        d3.select(self.frameElement).style("height", "500px");

        function zoom() {
            //console.log(d3.event.translate[0]);
            var wcanvas = $("#" + canvasId + " svg").width();
            var hcanvas = $("#" + canvasId + " svg").height();
            var displayedWidth = w * scale;
            var scale = d3.event.scale;
            var h = d3.select("#" + canvasId + " svg g").node().getBBox().height * scale;
            var w = d3.select("#" + canvasId + " svg g").node().getBBox().width * scale;

            var padding = 100;
            var translation = d3.event.translate;
            var tbound = -(h - hcanvas) - (padding);
            var bbound = padding;
            var lbound = -(w - wcanvas) - (padding);
            var rbound = padding;
            applyScaleText(scaleText, scale, root);
            // limit translation to thresholds
            if (h < (hcanvas - (padding * 2))) {
                bbound = tbound;
                tbound = padding;
            }
            if (w < (wcanvas - (padding * 2))) {
                rbound = lbound;
                lbound = padding;
            }

            translation = [
                Math.max(Math.min(translation[0], rbound), lbound),
                Math.max(Math.min(translation[1], bbound), tbound)
            ];
            zoomBehaviour.translate(translation);
            zoomBehaviour.scale(scale);
            if (settings.enableZoomSliders) {
                $("#zoomSlider" + trees[findTreeIndex(name)].data.id).val(scale);
            }
            //console.log("Width: "+w*scale+" || Height: "+h*scale+" /// "+"Left: "+translation[0]+" || Top: "+translation[1]);
            d3.select("#" + canvasId + " svg g")
                .attr("transform", "translate(" + translation + ")" + " scale(" + scale + ")");
            //console.log(d3.select("#"+canvasId+" svg g")[0]);
            updateDownloadLinkContent(canvasId);
        }
    }

    function preprocessTrees(index1, index2) {
        var tree1 = trees[index1].root;
        var tree2 = trees[index2].root;

        for (var i = 0; i < tree1.leaves.length; i++) {
            for (var j = 0; j < tree2.leaves.length; j++) {
                if (tree1.leaves[i].name === tree2.leaves[j].name) {
                    tree1.leaves[i].correspondingLeaf = tree2.leaves[j];
                    tree2.leaves[j].correspondingLeaf = tree1.leaves[i];
                }
            }
        }

        postorderTraverse(tree1, function(d) {
            d.deepLeafList = createDeepLeafList(d);
        });
        postorderTraverse(tree2, function(d) {
            d.deepLeafList = createDeepLeafList(d);
        });

        function getAllBCNs(d, t) {
            var children = getChildren(d);
            if (children.length > 0) {
                for (var a = 0; a < children.length; a++) {
                    getAllBCNs(children[a], t);
                }
                BCN(d, t);
                return;
            } else {
                BCN(d, t);
                return;
            }
        }
        getAllBCNs(tree1, tree2);
        getAllBCNs(tree2, tree1);
    }

    function getSpanningTree(node, leaves) {
        var nodes = [];
        for (var i = 0; i < node.leaves.length; i++) {
            for (var z = 0; z < leaves.length; z++) {
                if (node.leaves[i].name === leaves[z].name) {
                    nodes.push(node);
                    var children = getChildren(node);
                    for (var j = 0; j < children.length; j++) {
                        nodes = nodes.concat(getSpanningTree(children[j], leaves));
                    }
                    return nodes;
                }
            }
        }
        return nodes;
    }

    function namesOnly(leaf) {
        return leaf.name;
    }

    function getLeafS(v, n) {
        var intersect = 0;
        var lv = v.leaves.length;
        var ln = n.leaves.length;

        intersect = _.intersection(_.map(v.leaves, namesOnly), _.map(n.leaves, namesOnly)).length;
        return intersect / (lv + ln - intersect);
    }

    function createDeepLeafList(v) {
        var deepLeafList = [];
        var counter = 0;

        function buildDeepLeafList(d) {
            var children = getChildren(d);
            if (children.length > 0) {
                //console.log(_.map(d.leaves, namesOnly));
                if (counter > 0) {
                    deepLeafList.push(_.map(d.leaves, namesOnly));
                }
                counter += 1;
                for (var i = 0; i < children.length; i++) {
                    buildDeepLeafList(children[i]);
                }
                return;
            } else {
                deepLeafList.push(d.name);
                return;
            }
        }
        buildDeepLeafList(v);
        return deepLeafList;

    }

    function getElementS(v, n) {
        var intersect = 0;
        var lv = v.deepLeafList;
        var ln = n.deepLeafList;
        var lvlen = lv.length;
        var lnlen = ln.length;
        for (var i = 0; i < lvlen; i++) {
            for (var j = 0; j < lnlen; j++) {
                if (Array.isArray(lv[i]) && Array.isArray(ln[j])) {
                    if (lv[i].length === ln[j].length) {
                        var allEqual = true;
                        for (var k = 0; k < lv[i].length; k++) {
                            if (!(lv[i][k] === ln[j][k])) {
                                allEqual = false;
                                break;
                            }
                        }
                        if (allEqual) {
                            intersect += 1;
                            break;
                        }
                    }
                } else if (!Array.isArray(lv[i]) && !Array.isArray(ln[j]) && (lv[i] === ln[j])) {
                    intersect += 1;
                    break;
                }
            }
        }
        return intersect / (lvlen + lnlen - intersect);
    }

    function findTreeIndex(name) {
        for (var i = 0; i < trees.length; i++) {
            if (name === trees[i].name) {
                return i;
            }
        }
    }


    function compareTrees(name1, canvas1, name2, canvas2, scale1, scale2) {
        var index1 = findTreeIndex(name1);
        var index2 = findTreeIndex(name2);
        settings.loadingCallback();
        setTimeout(function() {
            preprocessTrees(index1, index2);
            trees[index1].data.clickEvent = getClickEventListener(trees[index1], true, trees[index2]);
            trees[index2].data.clickEvent = getClickEventListener(trees[index2], true, trees[index1]);
            renderTree(name1, canvas1, scale1);
            renderTree(name2, canvas2, scale2);
            settings.loadedCallback();
        }, 2);

    }


    function viewTree(name, canvasId, scaleId) {
        var index = findTreeIndex(name);
        settings.loadingCallback();
        setTimeout(function() {
            stripComparisonProcessing(trees[index].root);
            trees[index].data.clickEvent = getClickEventListener(trees[index], false, {});
            renderTree(name, canvasId, scaleId);
            settings.loadedCallback();
        }, 2);

    }


    function getFisheye() {
        /* 
        Fisheye Distortion Plugin from d3-plugins
        https://github.com/d3/d3-plugins/tree/master/fisheye
        Code by mbostock
        */
        return (function() {
            d3.fisheye = {
                scale: function(scaleType) {
                    return d3_fisheye_scale(scaleType(), 3, 0);
                },
                circular: function() {
                    var radius = 200,
                        distortion = 2,
                        k0,
                        k1,
                        focus = [0, 0];

                    function fisheye(d) {
                        var dx = d.x - focus[0],
                            dy = d.y - focus[1],
                            dd = Math.sqrt(dx * dx + dy * dy);
                        if (!dd || dd >= radius) return {
                            x: d.x,
                            y: d.y,
                            z: dd >= radius ? 1 : 10
                        };
                        var k = k0 * (1 - Math.exp(-dd * k1)) / dd * .75 + .25;
                        return {
                            x: focus[0] + dx * k,
                            y: focus[1] + dy * k,
                            z: Math.min(k, 10)
                        };
                    }

                    function rescale() {
                        k0 = Math.exp(distortion);
                        k0 = k0 / (k0 - 1) * radius;
                        k1 = distortion / radius;
                        return fisheye;
                    }

                    fisheye.radius = function(_) {
                        if (!arguments.length) return radius;
                        radius = +_;
                        return rescale();
                    };

                    fisheye.distortion = function(_) {
                        if (!arguments.length) return distortion;
                        distortion = +_;
                        return rescale();
                    };

                    fisheye.focus = function(_) {
                        if (!arguments.length) return focus;
                        focus = _;
                        return fisheye;
                    };

                    return rescale();
                }
            };

            function d3_fisheye_scale(scale, d, a) {

                function fisheye(_) {
                    var x = scale(_),
                        left = x < a,
                        range = d3.extent(scale.range()),
                        min = range[0],
                        max = range[1],
                        m = left ? a - min : max - a;
                    if (m == 0) m = max - min;
                    return (left ? -1 : 1) * m * (d + 1) / (d + (m / Math.abs(x - a))) + a;
                }

                fisheye.distortion = function(_) {
                    if (!arguments.length) return d;
                    d = +_;
                    return fisheye;
                };

                fisheye.focus = function(_) {
                    if (!arguments.length) return a;
                    a = +_;
                    return fisheye;
                };

                fisheye.copy = function() {
                    return d3_fisheye_scale(scale.copy(), d, a);
                };

                fisheye.nice = scale.nice;
                fisheye.ticks = scale.ticks;
                fisheye.tickFormat = scale.tickFormat;
                return d3.rebind(fisheye, scale, "domain", "range");
            }
        })();
        /*----------------------------------------*/
    }

    function getClickEventListener(tree, isCompared, comparedTree) {
        function nodeClick(d) {
            var bcnColors = d3.scale.category20();
            if (settings.clickAction === "collapse") {
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                update(d, tree.data);
            } else if (settings.clickAction == "highlight" && isCompared) {
                function colorLink(n, hl) {
                    if (n.children) {
                        for (var i = 0; i < n.children.length; i++) {
                            colorLink(n.children[i], hl);
                        }
                    }
                    if (hl) {
                        n.highlight += 1;
                    } else {
                        n.highlight -= 1;
                    }
                }

                if (!_.contains(highlightedNodes, d)) {
                    if (highlightedNodes.length < maxHighlightedNodes) {
                        d.clickedHighlight = bcnColors(highlightedNodes.length);
                        d[currentBCN].bcnhighlight = bcnColors(highlightedNodes.length);
                        highlightedNodes.push(d);
                        var leaves = d.leaves;
                        var otherTree = comparedTree.root;
                        var otherTreeData = comparedTree.data;
                        var otherTreeLeaves = otherTreeData.leaves;
                        for (var i = 0; i < leaves.length; i++) {
                            leaves[i].correspondingLeaf.highlight += 1;
                        }

                        if (settings.moveOnClick) {
                            var currentScale = otherTreeData.zoomBehaviour.scale()

                            var y = (-d[currentBCN].y + ($("#" + otherTreeData.canvasId).width() / 2) / currentScale);
                            var x = (-d[currentBCN].x + ($("#" + otherTreeData.canvasId).height() / 2) / currentScale);

                            otherTreeData.zoomBehaviour.translate([y, x]);
                            d3.select("#" + otherTreeData.canvasId + " svg g")
                                .transition(1500)
                                .attr("transform", "scale(" + currentScale + ")" + "translate(" + otherTreeData.zoomBehaviour.translate() + ")");
                        }
                        colorLink(d, true);
                        update(d, tree.data);
                        update(otherTreeData.root, otherTreeData);
                    }
                } else {
                    d.clickedHighlight = false;
                    var index = highlightedNodes.indexOf(d);
                    if (index > -1) {
                        highlightedNodes.splice(index, 1);
                    }
                    d[currentBCN].bcnhighlight = false;
                    var bcnid = d[currentBCN] ? d[currentBCN].id : -1;
                    var leaves = d.leaves;
                    var otherTree = comparedTree.root;
                    var otherTreeData = comparedTree.data;
                    var otherTreeLeaves = otherTreeData.leaves;
                    for (var i = 0; i < leaves.length; i++) {
                        leaves[i].correspondingLeaf.highlight -= 1;
                    }
                    colorLink(d, false);
                    update(d, tree.data);
                    update(otherTreeData.root, otherTreeData);
                }

            } else if (settings.clickAction == "reroot") {
                manualReroot = true;
                settings.loadingCallback();
                setTimeout(function() {
                    if (isCompared) {
                        var otherTreeData = comparedTree.data;
                        tree.root = reroot(tree.root, d);
                        tree.data.root = tree.root;
                        settings.loadedCallback();
                        postRerootClean(tree.root, tree.name);
                        postRerootClean(comparedTree.root);
                        preprocessTrees(trees.indexOf(tree), trees.indexOf(comparedTree));
                        update(tree.root, tree.data);
                        update(comparedTree.root, comparedTree.data);

                    } else {
                        tree.root = reroot(tree.root, d);
                        tree.data.root = tree.root;
                        settings.loadedCallback();
                        postRerootClean(tree.root, tree.name);
                        update(tree.root, tree.data);
                    }
                    //neccessary to fix bug where mouseout event cause highlight=-1 in clicked subtree
                    if (!settings.enableFisheyeZoom) {
                        postorderTraverse(d, function(x) {
                            x.highlight = 1;
                        });
                    } else {
                        postorderTraverse(d, function(x) {
                            x.highlight = 0;
                        });
                    }
                    manualReroot = false;
                }, 1);

            }
        }
        return nodeClick;
    }


    function stripComparisonProcessing(root) {
        postorderTraverse(root, function(d) {
            if (d.bcnhighlight) {
                d.bcnhighlight = null;
            }
            if (d.leafS) {
                d.leafS = null;
            }
            if (d.leafBCN) {
                d.leafBCN = null;
            }
            if (d.elementBCN) {
                d.elementBCN = null;
            }
            if (d.elementS) {
                d.elementS = null;
            }
        });
    }

    function BCN(v, tree) {

        var leafBCNNode = null;
        var elementBCNNode = null;
        var maxLeafS = 0;
        var maxElementS = 0;
        var leaves = v.leaves;
        var spanningTree = getSpanningTree(tree, leaves);
        for (var i = 0; i < spanningTree.length; i++) {
            //get leaf BCN for node v
            var x = getLeafS(v, spanningTree[i]);
            if (x > maxLeafS) {
                maxLeafS = x;
                leafBCNNode = spanningTree[i];
            }
            //get elementBCN for node v
            x = getElementS(v, spanningTree[i]);
            if (x > maxElementS) {
                maxElementS = x;
                elementBCNNode = spanningTree[i];
            }
        }
        v.leafBCN = leafBCNNode;
        v.leafS = maxLeafS;
        v.elementBCN = elementBCNNode;
        v.elementS = maxElementS;

        return;

    }


    return {
        init: init,
        viewTree: viewTree,
        renderColorScale: renderColorScale,
        setComparisonMetric: setComparisonMetric,
        addTree: addTree,
        removeTree: removeTree,
        getTrees: getTrees,
        compareTrees: compareTrees,
        changeSettings: changeSettings,
    }
})();
