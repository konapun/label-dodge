#DOCUMENTATION TODO

# Canvas Label Dodge

## Intro
Turn [this] into [this]!

## Usage
```js
var canvas = ..., //
    ctx = canvas.getContext('2d');
var dodger = new LabelDodge(ctx);
dodger.lineToRow(function(ctx2) { // ctx2 provides the same operations as ctx but as dodged versions (currently only drawImage and fillText)
	
});
```