function clone(arr){
    var ret = []
    for(var i in arr){
        ret.push(arr[i]);
    }
    return ret;
}