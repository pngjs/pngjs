var PNG = require("../lib/png").PNG;

(new PNG({width:1,height:1})).pack()
  .on('data', function(data) {
    console.log('data', data);
  })
  .on('end', function() {
    console.log('bitmap:', this.data);
    console.log('end !');
  });