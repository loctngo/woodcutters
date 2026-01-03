var INF = 1000000000;

function FFD(P,C){
    var n = P.length;

    var binMax = [];
    var bins = [];

    for(var i=0;i<n;i++){
        var found = false;
        for(var j=0;j<bins.length;j++) {
            if (binMax[j] + P[i] <= C) {
                binMax[j] += P[i];
                bins[j].push(P[i]);
                found = true;
                break;
            }
        }
        if(!found) {
            binMax.push(P[i]);
            bins.push([P[i]]);
        }
    }

    var cSum = 0;
    for(var i in bins){
        var arr = bins[i];
        arr.sort();
        var t = 0;
        for(var j in arr){
            t += arr[j];
            cSum += t;
        }
    }

    return {cSum: cSum,nBins: bins.length};
}

function bs(P,low,high,m){
    if(low == high){
        var result = FFD(P,low);
        result['cMax'] = low;
        return result;
    }

    var mid = Math.floor((low+high)/2);

    var result = FFD(P,mid);

    if(result.nBins <= m) {
        return bs(P, low, mid, m);
    }

    return bs(P,mid+1,high,m);
}

function Multifit(P,m){
    var sum = 0;
    var max = 0;
    var n = P.length;
    for(var i=0;i<n;i++){
        sum += P[i];
        max = Math.max(max,P[i]);
    }

    return bs(P,max,sum,m);
}

function randomGenerateNonpreemptive(nJobs, pMax){
    var nRemainJobs = nJobs - 1;
    while(true){
        var P = [];
        for(var i=0;i<nJobs;i++){
            var p = Math.floor(Math.random()*100)%pMax + 1;
            P.push(p);
        }

        var _P = clone(P);
        _P.sort(function(a, b){return b-a});

        var result = Multifit(_P,5);

        if(result.cMax <= 9){
            return {P: P, cMax:result.cMax, cSum: result.cSum};
        }
    }
}