var PNG = require("../lib/png").PNG;

(new PNG({width:1,height:1})).pack()
    .on("end", function() {
        console.log(this.data);
        console.log("end !");   // never called
    })