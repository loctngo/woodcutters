var INF = 1000000000;

function randomGeneratePreemptive(nJobs, pMax){
    var nRemainJobs = nJobs - 1;
    while(true){
        var P = [];
        for(var i=0;i<nJobs;i++){
            var p = Math.floor(Math.random()*100)%pMax + 1;
            P.push(p);
        }

        var _P = clone(P);
        _P.sort();

        var ret = LeungYoung(_P,5);
        if(ret == null){
            continue;
        }

        if(ret.cMax<=9) {
            return {P: P, cMax: ret.cMax, cSum: ret.cSum};
        }
    }
}

function LeungYoung(P,m){
    while(P.length%m != 0 || P.length == m){
        P = [0].concat(P);
    }

    var n = P.length;
    var C = [];
    for(var i=0;i<n;i++){
        C.push(0);
    }

    //add first n-m to table
    var F = [];
    for(var i=0;i<m;i++){
        F.push(0);
    }

    for(var j=0;j<n-m;j++){
        var minF = INF;
        var index = -1;
        for(var i=0;i<m;i++){
            if(minF > F[i]){
                minF = F[i];
                index = i;
            }
        }
        F[index] += P[j];
        C[j] = F[index];
    }
    
    //calculate OFT
    var OFT = 0;
    for(var i=0;i<m;i++){
        var p = 0;
        var r = 0;
        for(var j=0;j<=i;j++){
            p += F[j] + P[n-1-j];
            r++;
        }
        p /= r;
        OFT = Math.max(OFT,p);
    }

    if(OFT != Math.floor(OFT)){
        return null;
    }

    //add last m jobs to table
    var B = [];
    for(var i=0;i<m;i++){
        B.push(true);
    }

    for(var i=n-1;i>=n-m;i--){
        //check fit the least capacity
        var machineId = -1;
        for(var j=m-1;j>=0;j--){
            if(B[j]){
                if(OFT-F[j]>=P[i]){
                    machineId = j;
                }
                break;
            }
        }
        
        if(machineId!=-1){
            C[i] = F[machineId] + P[i];
            B[machineId] = false;
            continue;
        }

        //check perfectly fit
        machineId = -1;
        for(var j=0;j<m;j++){
            if(B[j] && P[i] == OFT-F[j]){
                machineId = j;
                break;
            }
        }
            
        if(machineId!=-1){
            C[i] = F[machineId] + P[i];
            B[machineId] = false;
            continue;
        }

        //must be existing l & u such as: B[l] = true & B[u] = true & OFT-F[l] > P[i] > OFT-F[u+1]
        for(var l=0;l<m-1;l++){
            if(B[l]){
            	var u = l+1;
            	while(!B[u]){
            		u++;
            	}
            	if(P[i] > OFT-F[u]){
	            	F[l] += P[i] - (OFT-F[u]);
	                F[u] = OFT;
	                C[i] = OFT;
	                B[u] = false;
	                break;
            	}
            }
        }
    }

    var cSum = 0;
    for(var i=0;i<n;i++){
        cSum += C[i];
    }

    return {cMax: OFT, cSum : cSum};
}
