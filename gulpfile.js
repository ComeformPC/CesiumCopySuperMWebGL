const browserSync=require("browser-sync").create();

function server(){
    browserSync.init({
        server:{
            baseDir:'./Source'
        },
        notify:false
    })
}
exports.start=server;