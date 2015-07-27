# TreeCompareJS
A Library for visualising and comparing phylogenetic trees on the web.

##Dependencies
TreeCompareJS requires JQuery, D3js and UnderscoreJS:
```html
<script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.6/d3.min.js"></script>
```

##Initialisation
An instance of TreeCompareJS is created using the init method:
```js
    var treecomp = TreeCompare.init();
```

Settings can be assigned at initilisation by passing a settings object with any settings set to desired values (see the 'Settings' section below for more info):
```js
    var treecomp = TreeCompare.init({
        treeHeight: 765,
    });
```

##Adding Trees
Add trees in Newick format to your TreeCompare object:
```js
treecomp.addTree("(D:0.3,(C:0.2,(A:0.1,B:0.1):0.1):0.1);");
```
You can add trees with a name too:
```js
treecomp.addTree("(D:0.3,(C:0.2,(A:0.1,B:0.1):0.1):0.1);", "My tree name");
```
Names must be unique, this method throws an exception if a tree is added with a non-unique name.
The method also throws an exception if the newick is invalid.

If no name is provided, the tree is given a default name of "Tree 1", "Tree 2", "Tree 3" etc.

##Visualising Trees
There are two visualisation styles, viewing and comparison:

###Viewing Trees
A single tree can be visualised using the viewTree method:
```js
treecomp.viewTree("Tree 1", "canvas-container-div", "scale-container-div");
```
This renders the tree with name "Tree 1" in the div with the id "canvas-container-div".
The third parameter is optional and is the id of the div where the tree's length scale will be rendered.

###Comparing Trees
Two trees can be compared using a comparison visualisation using the compareTrees method:
```js
treecomp.compareTrees("Tree 1", "canvas-container-div", "Tree 2", "canvas-container-div2", "scale-div1", "scale-div2") 
```
The tree named "Tree 1" is rendered in the div with id "canvas-container-div" and the tree named "Tree 2" is rendered in the div with id "canvas-container-div2". The scale div ids are optional and scales for each tree will be rendered in these divs if ids are provided.

##Settings
There are a number of settings available to manipulate the visualisations in real time. Settings can be changed with the changeSettings method:


