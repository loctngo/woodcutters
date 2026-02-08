/*
  screen width = 480px
  screen height = 800px
*/
var SLICE_SIZE = 64;
// size in points of each slice (same as slice.png)
var NUM_COLS = 5;
// maximum number of columns in gameboard
var NUM_ROWS = 9;
// maximum number of rows in gameboard
var PADDING_LOG = SLICE_SIZE*0.5;
// padding between gameboard and job
var GAMEPLAY_OFFSET = cc.p(SLICE_SIZE/2, SLICE_SIZE*2/3);
// offset so that game is not stuck to the bottom-left
var SCORE_PER_SLICE = 10;
// log when a slice is cleared
var BONUS = [50, 40, 30, 20, 10];

function PreemptiveSchedule(){
    //deadline
    this.deadline = null;

    //max total completion
    this.maxTC = null;
    /*
    ** machineId -> {enable:?}
    */
    this.machines = {};

    this.nMachines = function(){
        return Object.keys(this.machines).length;
    };

    this.unassignedSegmentIds = [];

    this.unassignedJobIds = function(){
        var unassignedJobs = {};
        for(var i=0;i<this.unassignedSegmentIds.length;i++){
            var unassignedSegmentId = this.unassignedSegmentIds[i];
            unassignedJobs[this.segments[unassignedSegmentId].jobId] = true;
        }
        return Object.keys(unassignedJobs);
    };

    /*
    ** machineId -> [segmentId]
    */
    this.assignments = {};

    /*
    ** jobId -> {processingTime: ?, color:?}
    */
    this.jobs = {};

    this.nJobs = function(){
        return Object.keys(this.jobs).length;
    };

    /*
    ** segmentId -> {processingTime: ?, jobId:?}
    */
    this.segments = {};

    this.nSegments = function(){
        return Object.keys(this.segments).length;
    };

    this.nextSegmentId = function(){
        var nextSegmentId = -1;
        for(var segmentId in this.segments)
            nextSegmentId = Math.max(Math.floor(segmentId),nextSegmentId);
        return (nextSegmentId+1).toString();
    };

    this.cloneAssignedJobIds = function(machineId){
        var jobIds = {};
        var assignedSegmentIds = this.assignments[machineId];
        for(var i=0;i<assignedSegmentIds.length;i++)
            jobIds[this.segments[assignedSegmentIds[i]].jobId] = true;;
        return Object.keys(jobIds);
    };

    this.cloneAssignedSegmentIds = function(machineId){
        var segmentIds = [];
        var assignedSegmentIds = this.assignments[machineId];
        for(var i=0;i<assignedSegmentIds.length;i++)
            segmentIds.push(assignedSegmentIds[i]);
        return segmentIds;
    };

    this.getAssignedMachineId = function(segmentId){
        for(var machineId in this.assignments){
            if(this.assignments[machineId].indexOf(segmentId)!=-1){
                return machineId;
            }
        }

        return null;
    };

    this.getProcessedTime = function(machineId){
        var processedTime = 0;
        var assignedSegmentIds = this.assignments[machineId];
        for(var i=0;i<assignedSegmentIds.length;i++)
            processedTime += this.segments[assignedSegmentIds[i]].processingTime;

        return processedTime;
    };

    this.getStartTime = function(machineId,segmentId){
        var start = 0;
        for(var i=0;i<this.assignments[machineId].length;i++){
            var sid = this.assignments[machineId][i];
            if(sid==segmentId)
                return start;
            start += this.segments[sid].processingTime;
        }
        return -1;
    };

    this.conflict = function(){
        for(var machineId in this.machines){
            var processedTime = this.getProcessedTime(machineId);
            if(processedTime > this.deadline)
                return true;
        }
        for(var segmentId1 in this.segments)
            for(var segmentId2 in this.segments)
                if(segmentId1!=segmentId2){
                    var m1 = this.getAssignedMachineId(segmentId1);
                    var j1 = this.segments[segmentId1].jobId;
                    var m2 = this.getAssignedMachineId(segmentId2);
                    var j2 = this.segments[segmentId2].jobId;
                    if(m1!=null && m2!=null && m1!=m2 && j1==j2){
                        var start1 = this.getStartTime(m1,segmentId1);
                        var end1 = start1 + this.segments[segmentId1].processingTime;
                        var start2 = this.getStartTime(m2,segmentId2);
                        var end2 = start2 + this.segments[segmentId2].processingTime;
                        if(end1>start1 && end2>start2 && (start2>=start1 && start2<end1 || start1>=start2&&start1<end2))
                            return true;
                    }
                }
        return false;
    };

    this.nextAvailableTime = function(machineId,jobId,processingTime){
        var segmentId = this.nextSegmentId();
        this.segments[segmentId] = {jobId: jobId, processingTime: processingTime};
        this.assignments[machineId].push(segmentId);
        var conflict = this.conflict();
        delete this.segments[segmentId];
        this.assignments[machineId].splice(-1);
        if(conflict)
            return -1;
        return this.getProcessedTime(machineId);
    };

    this.cSum = function(){
        var jobMax = [];
        var jobLength = this.nJobs();
        for(var i=0;i<jobLength;i++){
            jobMax.push(0);
        }

        for(var machineId in this.machines){
            var c = 0;
            for(var i=0;i<this.assignments[machineId].length;i++){
                var segmentId = this.assignments[machineId][i];
                c += this.segments[segmentId].processingTime;
                var jobId = this.segments[segmentId].jobId;
                jobMax[jobId] = Math.max(jobMax[jobId],c);
            }
        }

        var ret = 0;
        for(var i=0;i<jobLength;i++){
            ret += jobMax[i];
        }

        return ret;
    };

    this.cMax = function(){
        var cMax = 0;
        for(var machineId in this.machines){
            var c = 0;
            for(var i=0;i<this.assignments[machineId].length;i++){
                var segmentId = this.assignments[machineId][i];
                c += this.segments[segmentId].processingTime;
                cMax = Math.max(cMax, c);
            }
        }
        return cMax;
    };
};

var PreemptiveGameWorld = cc.Layer.extend({

    // member variable declarations
    initialTouchPos: null,
    currentTouchPos: null,
    // save screenSize for fast access
    screenSize: null,
    //game schedule
    facility: null,
    //light sprites
    lightSprites: null,
    //indicator sprites
    indicatorSprites: null,
    //segment sprites
    segmentSprites: null,
    //outline sprite showing when user is dragging the segment sprite
    //over the available machine column
    outlineSegmentSprite: null,
    draggingSegmentLength: null,
    draggingSegmentSprite: null,
    splittingSegmentLength: null,
    splittingSegmentSprite: null,
    //ready segment id on the preview section
    readySegmentId: null,
    //split segment id
    splitSegmentId: null,
    //positons of all sprites
    segmentSpritePositions:null,
    //positons of all machines
    machineCenters:null,
    //machineId ready to push the selected job sprite in
    selectedMachineId: null,
    //machine state before dropping down the jobs
    //in order to restore the action
    storedMachine: null,
    // remaining logs and time
    dt: 0.1,
    touchingTime: null,
    holdingTimeMax: 0.2,
    log:null,
    logLabel: null,
    time:0,
    timeLabel: null,
    // buttons and popups
    pauseButton: null,
    popup: null,
    isGameOver: false,

    init:function () {
        this._super();

        this.screenSize = cc.Director.getInstance().getWinSize();

        this.createGameData();
        this.createBackground();
        this.createGameObjects();
        this.createHUD();
        this.doCountupAnimation();
        return true;
    },

    createGameData:function(){
        //initialize schedule data
        preemptiveLevel = getCookie('preemptiveLevel') == "" ? 1 : parseInt(getCookie('preemptiveLevel'));
        var schedule = randomGeneratePreemptive(scenes[preemptiveLevel].nJobs, scenes[preemptiveLevel].pMax);

        this.facility = new PreemptiveSchedule();

        this.facility.deadline = schedule.cMax;

        this.facility.maxTC = schedule.cSum;

        this.facility.machines = {
            0: {enabled: false},
            1: {enabled: false},
            2: {enabled: false},
            3: {enabled: false},
            4: {enabled: false}
        };


        var jobs = schedule.P;
        this.facility.jobs = {};
        this.facility.segments = {};
        this.facility.unassignedSegmentIds = [];
        for(var i=0;i<jobs.length;i++){
            this.facility.jobs[i] = {
                processingTime: jobs[i],
                color: colors[i]
            };

            this.facility.segments[i] = {
                processingTime: jobs[i],
                jobId: i.toString()
            };

            this.facility.unassignedSegmentIds.push(i.toString());
        }

        this.facility.assignments = {
            0: [],
            1: [],
            2: [],
            3: [],
            4: []
        };
    },

    createBackground:function(){
        // same as main menu
        var background = cc.LayerColor.create(cc.c4b(25, 0, 51, 255), this.screenSize.width, this.screenSize.height);
        this.addChild(background);

        // generate vertices for the gameplay frame
        var vertices = [];
        vertices[0] = cc.pAdd(GAMEPLAY_OFFSET, cc.p(-1, -1));
        vertices[1] = cc.pAdd(GAMEPLAY_OFFSET, cc.p(-1, NUM_ROWS*SLICE_SIZE+1));
        vertices[2] = cc.pAdd(GAMEPLAY_OFFSET, cc.p(NUM_COLS*SLICE_SIZE+1, NUM_ROWS*SLICE_SIZE+1));
        vertices[3] = cc.pAdd(GAMEPLAY_OFFSET, cc.p(NUM_COLS*SLICE_SIZE+1, -1));
        // use new DrawingPrimitive class
        var gamePlayFrame = cc.DrawNode.create();
        gamePlayFrame.drawPoly(vertices, cc.c4f(0.9, 0.9, 0.9, 1), 1, cc.c4f(0.6, 0.6, 0.6, 1));
        // must add the DrawNode else it won't be drawn at all
        this.addChild(gamePlayFrame);

        //create a Grid
        //draw horizontal lines
        for(var i=0;i<=NUM_ROWS;i++){
            var lineNode = cc.DrawNode.create();
            if(i==0){
                lineNode.drawSegment(cc.pAdd(GAMEPLAY_OFFSET, cc.p(-1, -1)), cc.pAdd(GAMEPLAY_OFFSET, cc.p(this.facility.nMachines()*SLICE_SIZE+1, -1)), 1, cc.c4f(0.6, 0.6, 0.6, 1));
            }
            if(i==NUM_ROWS){
                lineNode.drawSegment(cc.pAdd(GAMEPLAY_OFFSET, cc.p(-1, i*SLICE_SIZE+1)), cc.pAdd(GAMEPLAY_OFFSET, cc.p(this.facility.nMachines()*SLICE_SIZE+1, i*SLICE_SIZE+1)), 1, cc.c4f(0.6, 0.6, 0.6, 1));
            }
            if(i>0&&i<NUM_ROWS)
                lineNode.drawSegment(cc.pAdd(GAMEPLAY_OFFSET, cc.p(0, i*SLICE_SIZE)), cc.pAdd(GAMEPLAY_OFFSET, cc.p(this.facility.nMachines()*SLICE_SIZE, i*SLICE_SIZE)), 1, cc.c4f(0.7, 0.7, 0.7, 1));

            this.addChild(lineNode);
        }
        //draw vertical lines
        for(var i=0;i<=this.facility.nMachines();i++){
            var lineNode = cc.DrawNode.create();

            if(i==0)
                lineNode.drawSegment(cc.pAdd(GAMEPLAY_OFFSET, cc.p(-1, -1)), cc.pAdd(GAMEPLAY_OFFSET, cc.p(-1, NUM_ROWS*SLICE_SIZE+1)), 1, cc.c4f(0.6, 0.6, 0.6, 1));

            if(i==this.facility.nMachines())
                lineNode.drawSegment(cc.pAdd(GAMEPLAY_OFFSET, cc.p(i*SLICE_SIZE+1, -1)), cc.pAdd(GAMEPLAY_OFFSET, cc.p(i*SLICE_SIZE+1, NUM_ROWS*SLICE_SIZE+1)), 1, cc.c4f(0.6, 0.6, 0.6, 1));

            if(i>0&&i<this.facility.nMachines())
                lineNode.drawSegment(cc.pAdd(GAMEPLAY_OFFSET, cc.p(i*SLICE_SIZE, 0)), cc.pAdd(GAMEPLAY_OFFSET, cc.p(i*SLICE_SIZE, NUM_ROWS*SLICE_SIZE)), 1, cc.c4f(0.7, 0.7, 0.7, 1));

            this.addChild(lineNode);
        }

        // label to show the level of the game
        var levelLabel = cc.LabelTTF.create("#"+preemptiveLevel, "Shantell Sans", 30);
        levelLabel.setColor(S_COLOR.WHITE);
        levelLabel.setPosition(cc.p(this.screenSize.width * 0.11, this.screenSize.height * 0.911));
        this.addChild(levelLabel);

        // label to show the title of the game
        var titleLabel = cc.LabelTTF.create("Wood", "Shantell Sans", 45);
        titleLabel.setColor(T_COLOR.ORANGE);
        titleLabel.setPosition(cc.p(this.screenSize.width * 0.5-85, this.screenSize.height * 0.92));
        this.addChild(titleLabel);
        titleLabel = cc.LabelTTF.create("Cutters", "Shantell Sans", 45);
        titleLabel.setColor(S_COLOR.WHITE);
        titleLabel.setPosition(cc.p(this.screenSize.width * 0.5+55, this.screenSize.height * 0.92));
        this.addChild(titleLabel);

        // menu containing a button to pause the game
        this.pauseButton = cc.MenuItemSprite.create(cc.Sprite.create(s_Pause));
        this.pauseButton.setCallback(this.onPauseClicked, this);
        this.pauseButton.setPosition(cc.p(this.screenSize.width * 0.9, this.screenSize.height * 0.92));
        this.pauseButton.setEnabled(false);
        var pauseMenu = cc.Menu.create(this.pauseButton);
        pauseMenu.setPosition(cc.POINT_ZERO);
        this.addChild(pauseMenu,1);
    },

    createGameObjects:function(){
        //initialize machines
        this.machineCenters = {};
        this.lightSprites = {};
        var lightCenter = cc.pAdd(GAMEPLAY_OFFSET, cc.p(SLICE_SIZE/2, -4));
        var machineCenter = cc.pAdd(GAMEPLAY_OFFSET, cc.p(SLICE_SIZE/2, NUM_ROWS*SLICE_SIZE/2));

        for(var i in this.facility.machines){
            var sprite = cc.Sprite.create(s_Light);
            sprite.setColor(S_COLOR.YELLOW);
            sprite.setPosition(lightCenter);
            this.addChild(sprite);
            this.lightSprites[i] = sprite;
            lightCenter = cc.pAdd(lightCenter,cc.p(SLICE_SIZE,0));
            this.machineCenters[i] = machineCenter;
            machineCenter = cc.pAdd(machineCenter,cc.p(SLICE_SIZE,0));
        }

        var segments = this.facility.segments;
        this.segmentSprites = {};
        this.segmentSpritePositions = {};

        // create sprites
        var segmentId = 0;
        var processingTime = segments[segmentId].processingTime;
        var center = cc.pAdd(GAMEPLAY_OFFSET, cc.p((NUM_COLS+0.5) * SLICE_SIZE + PADDING_LOG, processingTime/2 * SLICE_SIZE))
        var sprite = cc.Sprite.create(WOODS[processingTime]);
        var jobColor = this.facility.jobs[segments[segmentId].jobId].color;
        sprite.setColor(jobColor);
        sprite.setPosition(center);
        this.segmentSprites[segmentId] = sprite;

        this.segmentSpritePositions[segmentId] = center;
        this.readySegmentId = segmentId;
        this.addChild(this.segmentSprites[segmentId]);

        this.indicatorSprites = [];
        this.adjustIndicator();
    },

    createHUD:function(){
        // initialize log and time
        this.log = Object.keys(this.facility.jobs).length;
        this.time = 0;

        // create labels for log, cSum and time
        this.logLabel = cc.LabelTTF.create("logs: " + this.log, "Shantell Sans", 18);
        this.logLabel.setPosition(cc.p(this.screenSize.width * 0.15, this.screenSize.height * 0.85));
        this.addChild(this.logLabel);

        this.cSumLabel = cc.LabelTTF.create("Σ Completion: " + this.facility.cSum() + " ≤ "+this.facility.maxTC, "Shantell Sans", 18);
        this.cSumLabel.setPosition(cc.p(this.screenSize.width * 0.50, this.screenSize.height * 0.85));
        this.addChild(this.cSumLabel);

        this.timeLabel = cc.LabelTTF.create("⏱: " + this.time, "Shantell Sans", 18);
        this.timeLabel.setPosition(cc.p(this.screenSize.width * 0.85, this.screenSize.height * 0.85));
        this.addChild(this.timeLabel);
    },

    doCountupAnimation:function(){
        // create the four labels
        var labels = [];
        for(var i = 0; i < 4; ++i)
        {
            labels[i] = cc.LabelTTF.create("", "Shantell Sans", 52);
            // position the label at the centre of the screen
            labels[i].setPosition(cc.p(this.screenSize.width/2, this.screenSize.height/2));
            labels[i].setColor(cc.c3b(90, 90, 90));

            // reduce opacity so that the label is invisible
            labels[i].setOpacity(0);
            // enlarge the label
            labels[i].setScale(3);
            this.addChild(labels[i]);
        }

        // assign strings
        labels[0].setString("3");
        labels[1].setString("2");
        labels[2].setString("1");
        labels[3].setString("Start");

        // fade in and scale down at the same time
        var fadeInScaleDown = cc.Spawn.create(cc.FadeIn.create(0.1), cc.EaseBackOut.create(cc.ScaleTo.create(0.1, 1)));
        // stay on screen for a bit
        var waitOnScreen = cc.DelayTime.create(0.5);
        // remove label and cleanup
        var removeSelf = cc.RemoveSelf.create(true);

        for(var i = 0; i < 4; ++i)
        {
            // since the labels should appear one after the other,
            // we give them increasing delays before they appear
            var delayBeforeAppearing = cc.DelayTime.create(0.7*i+1);
            var countdownAnimation = cc.Sequence.create(delayBeforeAppearing, fadeInScaleDown, waitOnScreen, removeSelf);
            labels[i].runAction(countdownAnimation);
            if(i==3)
                this.runAction(cc.Sequence.create(delayBeforeAppearing,cc.CallFunc.create(function(){
                    cc.AudioEngine.getInstance().playEffect(s_Start_m4a);
                }, this)));
            else
                this.runAction(cc.Sequence.create(delayBeforeAppearing,cc.CallFunc.create(function(){
                    cc.AudioEngine.getInstance().playEffect(s_Beep_m4a);
                }, this)));
        }

        // after the animation has finished, start the game
        var waitForAnimation = cc.DelayTime.create(4);
        var finishCountdownAnimation = cc.CallFunc.create(this.finishCountdownAnimation, this);
        this.runAction(cc.Sequence.create(waitForAnimation, finishCountdownAnimation));
    },

    finishCountdownAnimation:function(){
        // start executing the game timer
        this.schedule(this.updateTimer, 1);
        // finally allow the user to touch
        this.setTouchEnabled(true);
        this.pauseButton.setEnabled(true);
    },

    updateLog:function(){
        this.log = this.facility.unassignedJobIds().length;
        this.logLabel.setString("logs: " + this.log);
        this.cSumLabel.setString("Σ Completion: " + this.facility.cSum() + " ≤ "+this.facility.maxTC, "Shantell Sans", 18);
        // run a simple action so the user knows the log is being added
        // use the ease functions to create a heart beat effect
        this.logLabel.runAction(cc.Sequence.create(cc.EaseSineIn.create(cc.ScaleTo.create(0.125, 1.1)), cc.EaseSineOut.create(cc.ScaleTo.create(0.125, 1))));
        this.cSumLabel.runAction(cc.Sequence.create(cc.EaseSineIn.create(cc.ScaleTo.create(0.125, 1.1)), cc.EaseSineOut.create(cc.ScaleTo.create(0.125, 1))));
        if(this.facility.unassignedJobIds().length == 0 && this.facility.cSum()<=this.facility.maxTC){
            //disable touching everything else except the dialog
            this.setTouchEnabled(false);
            this.pauseButton.setEnabled(false);
            this.unscheduleAllCallbacks();
            this.runAction(cc.Sequence.create(cc.DelayTime.create(2), cc.CallFunc.create(function(){
                this.showGameWonPopup();
            }, this)));
        }
    },

    updateTimer:function(){
        // this is called every second so increase the time by 1
        this.time++;
        var s = this.time;
        var h = Math.floor(s/3600);
        var m = Math.floor((s-h*3600)/60);
        s -= h*3600 + m*60;
        var timeStr = null;
        if(h>0)
            timeStr = h + ":" + (m > 9 ? m : '0'+m) + ":" + (s > 9 ? s : '0'+s);
        else{
            if(m>0)
                timeStr = m + ":" + (s > 9 ? s : '0'+s);
            else
                timeStr = s;
        }
        // update the time left label
        this.timeLabel.setString("⏱: " + timeStr);
    },

    increaseTouchingTime:function(){
        this.touchingTime += this.dt;
        if(this.touchingTime>=this.holdingTimeMax){
            //highlight the job
            var machines = this.facility.machines;
            var segments = this.facility.segments;
            for(var segmentId in segments){
                var jobId = this.facility.segments[segmentId].jobId;
                var job = this.facility.jobs[jobId];
                if(this.segmentSprites[segmentId]!=null &&
                    this.inside(this.segmentSprites[segmentId],this.initialTouchPos) &&
                    this.inside(this.segmentSprites[segmentId],this.currentTouchPos)){
                    //calculate how many units from the top to split off the current segment
                    var readySprite = this.segmentSprites[segmentId];
                    var center = readySprite.getPosition();
                    var height = readySprite.getContentSize().height;
                    var top = center.y+height/2;
                    var processingTime = Math.ceil((top - this.currentTouchPos.y)/SLICE_SIZE);
                    this.draggingSegmentLength = processingTime;

                    this.facility.segments[segmentId].processingTime -= processingTime;
                    if(!this.facility.conflict()){
                        //update UI
                        var topCenter = cc.p(center.x,top - processingTime/2*SLICE_SIZE);
                        //override highlight segment on top
                        this.draggingSegmentSprite = cc.Sprite.create(WHITES[processingTime]);
                        this.draggingSegmentSprite.setColor(this.facility.jobs[jobId].color);
                        this.draggingSegmentSprite.setPosition(topCenter);
                        this.addChild(this.draggingSegmentSprite,1);

                        //enable machines
                        for(var i in this.facility.machines){
                            if(this.facility.nextAvailableTime(i,jobId,processingTime)>-1){
                                this.enableMachine(i);
                            }
                        }
                        this.splitSegmentId = segmentId;
                        this.runAction(cc.Sequence.create(cc.DelayTime.create(0.01), cc.CallFunc.create(function(){
                            this.unschedule(this.increaseTouchingTime);
                        }, this)));
                    }
                    this.facility.segments[segmentId].processingTime += processingTime;
                    return;
                }
            }
        }
    },

    onTouchesBegan:function (touches, event) {
        // get touch coordinates
        var touch = cc.p(touches[0].getLocation().x, touches[0].getLocation().y);
        this.initialTouchPos = touch;
        this.currentTouchPos = touch;
        this.touchingTime = 0;
        this.schedule(this.increaseTouchingTime, this.dt);
    },

    onTouchesMoved:function(touches, event){
        if(this.initialTouchPos==null||this.initialTouchPos==null)
            return;
        var touch = cc.p(touches[0].getLocation().x, touches[0].getLocation().y);

        if(this.splitSegmentId!=null){
            var segmentId = this.splitSegmentId;
            var selectedSprite = this.segmentSprites[segmentId];
            var jobId = this.facility.segments[segmentId].jobId;

            if(this.draggingSegmentLength !=null){
                var center = selectedSprite.getPosition();
                var height = selectedSprite.getContentSize().height;
                var top = center.y+height/2;
                var left = center.x - SLICE_SIZE/2;
                var right = center.x + SLICE_SIZE/2;
                if(this.inside(selectedSprite, touch)){
                    if(touch.x>=left && touch.x<=right){
                        var processingTime = Math.ceil((top - touch.y)/SLICE_SIZE);
                        this.draggingSegmentLength = processingTime
                        this.draggingSegmentSprite.removeFromParent(true);
                        //just updating dragging segment
                        var topCenter = cc.p(center.x, top - processingTime/2*SLICE_SIZE);
                        //override highlight segment on top
                        this.draggingSegmentSprite = cc.Sprite.create(WHITES[processingTime]);
                        this.draggingSegmentSprite.setColor(this.facility.jobs[jobId].color);
                        this.draggingSegmentSprite.setPosition(topCenter);
                        this.addChild(this.draggingSegmentSprite,2);
                    }
                }
                else{
                    if(touch.y>top){
                        //remove splitting part
                        this.draggingSegmentLength = 0;
                        this.draggingSegmentSprite.removeFromParent(true);
                        this.currentTouchPos = touch;
                    }
                    else{
                        //split the selected segment into 2 segments
                        var splittingCenter = cc.pAdd(touch,cc.p(0, (this.draggingSegmentLength-1)/2*SLICE_SIZE));
                        this.splittingSegmentSprite = this.draggingSegmentSprite;
                        this.splittingSegmentSprite.setPosition(splittingCenter);
                        this.splittingSegmentLength = this.draggingSegmentLength;

                        //reduce height of selected segment
                        var processingTime = this.facility.segments[segmentId].processingTime -
                            this.draggingSegmentLength;
                        //update facility data
                        this.facility.segments[segmentId].processingTime = processingTime;
                        //update UI
                        center = cc.pSub(center,cc.p(0,this.draggingSegmentLength/2*SLICE_SIZE));
                        this.segmentSprites[segmentId].removeFromParent(true);
                        this.segmentSprites[segmentId] = null;
                        if(processingTime>0){
                            this.segmentSprites[segmentId] = cc.Sprite.create(WOODS[processingTime]);
                            this.segmentSprites[segmentId].setColor(this.facility.jobs[jobId].color);
                            this.segmentSprites[segmentId].setPosition(center);
                            this.addChild(this.segmentSprites[segmentId],1);
                        }
                        this.draggingSegmentLength = null;
                        this.draggingSegmentSprite = null;

                        //check if all of its after jobs were dropped down to the machine
                        //list of all its after jobs
                        var machineId = this.facility.getAssignedMachineId(segmentId);
                        if(machineId!=null){
                            var assignedSegmentIds = this.facility.assignments[machineId];
                            var index = assignedSegmentIds.indexOf(segmentId);
                            var afterSegments = assignedSegmentIds.slice(index+1);

                            //drop after segments to new position
                            //update UI
                            for(var i=0;i<afterSegments.length;i++){
                                var afterSegmentId = afterSegments[i];
                                var center = this.segmentSprites[afterSegmentId].getPosition();
                                center = cc.pSub(center,cc.p(0,this.splittingSegmentLength*SLICE_SIZE));
                                this.segmentSprites[afterSegmentId].setPosition(center);
                            }

                            var storedSegmentIds = this.facility.cloneAssignedSegmentIds(machineId);
                            //we also need to store the state before dropping to restore if if necessary
                            this.storedMachine = {
                                machineId: machineId,
                                segmentIds: storedSegmentIds
                            };

                            if(this.facility.nextAvailableTime(machineId,jobId,this.splittingSegmentLength)>-1)
                                this.enableMachine(machineId);
                            this.adjustIndicator();
                        }
                        if(processingTime>0)
                            cc.AudioEngine.getInstance().playEffect(s_Chop_m4a);
                    }
                }
            }
            else{
                //dragging splitting segment around the screen
                var processingTime = this.splittingSegmentLength;
                var offset = cc.pSub(touch,this.currentTouchPos);
                var center = this.splittingSegmentSprite.getPosition();
                center = cc.pAdd(center, offset);
                this.splittingSegmentSprite.setPosition(center);

                //check if we drag it into the available machine column
                var machines = this.facility.machines;
                var selectedMachineId = null;
                for(var i in machines)
                    if(machines[i].enabled){
                        var machineCenter = this.machineCenters[i];
                        var distance = cc.pSub(this.splittingSegmentSprite.getPosition(), machineCenter);
                        if(Math.abs(distance.x) < SLICE_SIZE/2 &&
                            Math.abs(distance.y) < (NUM_ROWS + processingTime)*SLICE_SIZE/2){
                            selectedMachineId = i;
                            break;
                        }
                    }

                if(selectedMachineId!=null){
                    var nextTime = this.facility.nextAvailableTime(selectedMachineId,jobId,this.splittingSegmentLength);
                    var outlineSegmentSpriteCenter = cc.p(machineCenter.x,
                        machineCenter.y + (nextTime + processingTime/2 - NUM_ROWS/2)*SLICE_SIZE);
                    var job = this.facility.jobs[this.facility.segments[this.splitSegmentId].jobId]
                    if(this.selectedMachineId==null){
                        this.selectedMachineId = selectedMachineId;
                        this.outlineSegmentSprite = cc.Sprite.create(FRAME_OUTLINES[processingTime]);
                        this.outlineSegmentSprite.setColor(job.color);
                        this.outlineSegmentSprite.setPosition(outlineSegmentSpriteCenter);
                        this.addChild(this.outlineSegmentSprite);
                    }
                    else{
                        if(this.selectedMachineId!=selectedMachineId){
                            //move to different machine,selectedMachineIdreset the color and position
                            this.selectedMachineId = selectedMachineId;
                            this.outlineSegmentSprite.setColor(job.color);
                            this.outlineSegmentSprite.setPosition(outlineSegmentSpriteCenter);
                        }
                    }
                }
                else{
                    if(this.selectedMachineId != null){
                        this.selectedMachineId = null;
                        this.outlineSegmentSprite.removeFromParent(true);
                    }
                }
            }
        }
        this.currentTouchPos = touch;
    },

    onTouchesEnded:function(touches, event){
        if(this.initialTouchPos==null||this.currentTouchPos==null)
            return;
        this.unschedule(this.increaseTouchingTime);

        //check if we are dropping it to the machine
        if(this.selectedMachineId!=null){
            this.pushSegment(this.selectedMachineId);
            this.updateLog();
            return;
        }

        //the log was split into to parts
        if(this.splittingSegmentLength!=null){
            var jobId = this.facility.segments[this.splitSegmentId].jobId;
            var splitSegmentId = this.splitSegmentId;
            var splitSegmentLength = this.facility.segments[this.splitSegmentId].processingTime;
            var processingTime = this.splittingSegmentLength + splitSegmentLength;
            //pull the job back to its previous position
            if(this.storedMachine!=null){
                this.splittingSegmentSprite.removeFromParent(true);
                this.splittingSegmentSprite = null;
                //we need to restore the machine back to previous state
                var machineId = this.storedMachine.machineId;
                var segmentIds = this.storedMachine.segmentIds;
                //update UI
                var segmentIndex = segmentIds.indexOf(splitSegmentId);
                //pull back the segments on the top of segment
                for(var i=segmentIndex+1;i<segmentIds.length;i++){
                    var afterSegmentId = segmentIds[i];
                    var center = this.segmentSpritePositions[segmentIds[i]];
                    this.segmentSprites[afterSegmentId].setPosition(center);
                }
                var center = this.segmentSpritePositions[splitSegmentId];

                if(this.segmentSprites[splitSegmentId])
                    this.segmentSprites[splitSegmentId].removeFromParent(true);

                var processingTime = this.splittingSegmentLength + this.facility.segments[splitSegmentId].processingTime;
                this.segmentSprites[splitSegmentId] = cc.Sprite.create(WOODS[processingTime]);
                var job = this.facility.jobs[this.facility.segments[splitSegmentId].jobId];
                this.segmentSprites[splitSegmentId].setColor(job.color);
                this.segmentSprites[splitSegmentId].setPosition(center);
                this.addChild(this.segmentSprites[splitSegmentId]);

                //restore the selected segment in facility
                this.facility.segments[splitSegmentId].processingTime = processingTime
                this.splitSegmentId = null;
                this.splittingSegmentLength = null;
                this.storedMachine = null;
                this.splitSegmentId = null;

                //disable machines
                for(var i in this.facility.machines)
                    this.disableMachine(i);
                this.adjustIndicator();
                return;
            }

            //restore the ready segment
            this.splittingSegmentSprite.removeFromParent(true);
            this.splittingSegmentSprite = null;

            var center = this.segmentSpritePositions[splitSegmentId];
            if(this.segmentSprites[splitSegmentId])
                this.segmentSprites[splitSegmentId].removeFromParent(true);

            this.segmentSprites[splitSegmentId] = cc.Sprite.create(WOODS[processingTime]);
            this.segmentSprites[splitSegmentId].setColor(this.facility.jobs[jobId].color);
            this.segmentSprites[splitSegmentId].setPosition(center);
            this.addChild(this.segmentSprites[splitSegmentId]);

            this.splitSegmentId = null;
            this.splittingSegmentLength = null;

            //restore the selected segment in facility
            this.facility.segments[splitSegmentId].processingTime = processingTime
            //disable machines
            for(var i in this.facility.machines)
                this.disableMachine(i);
            this.adjustIndicator();
            return;
        }

        //clean up splitting
        if(this.splitSegmentId!=null){
            this.splitSegmentId = null;
            this.draggingSegmentLength = null;
            this.draggingSegmentSprite.removeFromParent(true);
            //disable machines
            for(var i in this.facility.machines)
                this.disableMachine(i);
            return;
        }

        //check if we click on the job from the grid
        var machines = this.facility.machines;
        var segments = this.facility.segments;
        var segmentId = null;

        for(var i in segments){
            if(this.segmentSprites[i]!=null &&
                this.inside(this.segmentSprites[i],this.initialTouchPos) &&
                this.inside(this.segmentSprites[i],this.currentTouchPos)){
                if(i!=this.readySegmentId)
                    segmentId = i;
                break;
            }
        }

        if(segmentId!=null){
            //make sure there's no conflict after popping the segment
            var segment = this.facility.segments[segmentId];
            var jobId = segment.jobId;
            processingTime = segment.processingTime;
            segment.processingTime = 0;
            var conflict = this.facility.conflict();
            segment.processingTime = processingTime;

            if(!conflict){
                //push the job to the unassigned segments
                this.segmentSprites[segmentId].removeFromParent(true);
                this.segmentSprites[segmentId] = null;
                this.segmentSpritePositions[segmentId] = null;

                //pull the after segments down to the segment's bottom
                var machineId = this.facility.getAssignedMachineId(segmentId);
                var segments = this.facility.assignments[machineId];
                var segmentIndex = segments.indexOf(segmentId);

                //pull back segments on the top of the segment
                for(var i=segmentIndex+1;i<segments.length;i++){
                    var afterSegmentId = segments[i];
                    var center = this.segmentSprites[afterSegmentId].getPosition();
                    center = cc.pSub(center,cc.p(0,processingTime*SLICE_SIZE));
                    this.segmentSprites[afterSegmentId].setPosition(center);
                    this.segmentSpritePositions[afterSegmentId] = center;
                }

                this.facility.assignments[machineId].splice(segmentIndex,1);

                //merge this popped up segment to the unassigned segment which shares the same job
                var merged = false;
                var unassignedSegmentIds = this.facility.unassignedSegmentIds;
                for(var i=0;i<unassignedSegmentIds.length;i++){
                    var unassignedSegmentId = unassignedSegmentIds[i];
                    var unassignedJobId = this.facility.segments[unassignedSegmentId].jobId;
                    if(unassignedJobId==jobId){
                        merged = true;
                        this.facility.segments[unassignedSegmentId].processingTime += processingTime;
                        if(this.segmentSprites[unassignedSegmentId]){
                            this.segmentSprites[unassignedSegmentId].removeFromParent(true);
                            this.segmentSprites[unassignedSegmentId] = null;
                        }
                        delete this.facility.segments[segmentId];
                        segmentId = unassignedSegmentId;
                        break;
                    }
                }

                if(!merged)
                    this.facility.unassignedSegmentIds.push(segmentId);

                //show it as the ready segment
                if(this.readySegmentId == null || this.readySegmentId == segmentId){
                    this.readySegmentId = segmentId;
                    this.bringSegment();
                }
                this.adjustIndicator();
                this.updateLog();
                cc.AudioEngine.getInstance().playEffect(s_Whoosh_m4a);
                return;
            }
        }

        // check if we swipe the ready job
        if(this.readySegmentId==null)
            return;

        segmentId = this.readySegmentId;
        var sprite = this.segmentSprites[segmentId];
        var center = sprite.getPosition();
        var width = sprite.getContentSize().width;
        var height = sprite.getContentSize().height;
        var left = center.x-width/2;
        var right = center.x+width/2;
        var top = center.y+height/2;
        var bottom = center.y-height/2;
        var x0 = this.initialTouchPos.x;
        var y0 = this.initialTouchPos.y
        var x1 = this.currentTouchPos.x;
        var y1 = this.currentTouchPos.y;

        if(x0 >= left && x0 <= right && y0 >= bottom && y0 <= top){
            var moveSegment = 0;

            if(x1!=x0 || y1!=y0){
                var cosa = (x0*x0 - x0*x1) / (Math.abs(x0)*Math.sqrt((x1-x0)*(x1-x0)+(y1-y0)*(y1-y0)));
                if (x0 - x1 > 10 && cosa > 0.8){
                    //swipe left
                    moveSegment = -1;
                }
                if (x0 - x1 < -10 && cosa < -0.8){
                    //swipe right
                    moveSegment = 1;
                }
            }

            if(moveSegment!=0){
                // disable touch so that the subsequent functions have time to execute
                this.setTouchEnabled(false);
                this.initialTouchPos = null;
                this.currentTouchPos = null;
                if(moveSegment==1)
                    center = cc.pAdd(center,cc.p(SLICE_SIZE/2,0));
                else
                    center = cc.pSub(center,cc.p(SLICE_SIZE/2,0));
                this.segmentSprites[segmentId].runAction(cc.Sequence.create(cc.MoveTo.create(0.25,center), cc.FadeOut.create(0.25), cc.RemoveSelf.create(true)));
                this.segmentSpritePositions[segmentId] = null;
                this.segmentSprites[segmentId] = null;

                var index = -1;
                for(var i=0; i<this.facility.unassignedSegmentIds.length; i++)
                    if(this.facility.unassignedSegmentIds[i]==this.readySegmentId){
                        index = i;
                        break;
                    }

                index -= moveSegment;

                if(index == this.facility.unassignedSegmentIds.length)
                    index = 0;

                if(index == -1)
                    index = this.facility.unassignedSegmentIds.length-1;

                this.readySegmentId = this.facility.unassignedSegmentIds[index];
                cc.AudioEngine.getInstance().playEffect(s_Swipe_m4a);
                this.runAction(cc.Sequence.create(cc.DelayTime.create(0.5), cc.CallFunc.create(this.bringSegment, this)));
            }
        }
    },

    inside:function(sprite, pos){
        var center = sprite.getPosition();
        var width = sprite.getContentSize().width;
        var height = sprite.getContentSize().height;
        var left = center.x-width/2;
        var right = center.x+width/2;
        var top = center.y+height/2;
        var bottom = center.y-height/2;
        return pos.x>=left && pos.x<=right && pos.y>=bottom &&pos.y<=top;
    },

    pushSegment:function(machineId){
        var splitSegmentId = this.splitSegmentId;
        var splitSegment = this.facility.segments[splitSegmentId]
        var jobId = this.facility.segments[splitSegmentId].jobId;
        var job = this.facility.jobs[jobId];
        var processingTime = this.splittingSegmentLength;

        //updating UI
        var center = this.outlineSegmentSprite.getPosition();
        this.splittingSegmentSprite.removeFromParent(true);
        this.outlineSegmentSprite.removeFromParent(true);

        //disable machines
        for(var i in this.facility.machines)
            this.disableMachine(i);

        //check if we should 2 adjacent segments with in the same job
        var segmentIds = this.facility.assignments[machineId];
        var lastSegmentId = segmentIds.length>0 ? segmentIds[segmentIds.length-1] : null;
        var lastJobId = lastSegmentId == null ? null : this.facility.segments[lastSegmentId].jobId;
        if(lastJobId==jobId){
            var lastCenter = this.segmentSprites[lastSegmentId].getPosition();
            this.segmentSprites[lastSegmentId].removeFromParent(true);
            center = cc.p(center.x, lastCenter.y+processingTime*SLICE_SIZE/2);
            processingTime += this.facility.segments[lastSegmentId].processingTime;
            this.facility.segments[lastSegmentId].processingTime = processingTime;
            segmentId = lastSegmentId;
        }
        else{
            var segmentId = this.facility.nextSegmentId();
            this.facility.segments[segmentId] = {jobId:jobId, processingTime: processingTime};
            this.facility.assignments[machineId].push(segmentId);
        }

        var segmentSprite = cc.Sprite.create(WOODS[processingTime]);
        segmentSprite.setColor(job.color);
        segmentSprite.setPosition(center);
        this.addChild(segmentSprite);
        this.segmentSprites[segmentId] = segmentSprite;
        this.segmentSpritePositions[segmentId] = center;
        this.segmentSpritePositions[segmentId] = center;

        //adjust split segment center
        center = this.segmentSpritePositions[splitSegmentId];
        center = cc.pSub(center,cc.p(0,processingTime*SLICE_SIZE/2));
        this.segmentSpritePositions[splitSegmentId] = center;

        if(splitSegment.processingTime==0){
            //remove the segment out of facility
            var machineId = this.facility.getAssignedMachineId(splitSegmentId);
            delete this.facility.segments[splitSegmentId];
            delete this.segmentSpritePositions[splitSegmentId];
            if(machineId!=null){
                var removedIndex = -1;
                var assignments = this.facility.assignments[machineId];
                for(var i=0;i<assignments.length;i++)
                    if(assignments[i]==splitSegmentId){
                        removedIndex = i;
                        break;
                    }
                assignments.splice(removedIndex,1);
            }

            if(this.splitSegmentId==this.readySegmentId){
                //update new ready segment when we are selecting it but not the segment from the grid
                var removedIndex = -1;
                var unassignedSegmentIds = this.facility.unassignedSegmentIds;
                for(var i=0;i<unassignedSegmentIds.length;i++)
                    if(unassignedSegmentIds[i]==splitSegmentId){
                        removedIndex = i;
                        break;
                    }
                this.facility.unassignedSegmentIds.splice(removedIndex,1);

                if(unassignedSegmentIds.length>0){
                    if(removedIndex==unassignedSegmentIds.length)
                        this.readySegmentId = unassignedSegmentIds[0];
                    else
                        this.readySegmentId = unassignedSegmentIds[removedIndex];
                    this.setTouchEnabled(false);
                    this.initialTouchPos = null;
                    this.currentTouchPos = null;
                    this.runAction(cc.Sequence.create(cc.DelayTime.create(0.5), cc.CallFunc.create(this.bringSegment, this)));
                }
                else{
                    this.readySegmentId = null;
                }
            }
        }

        if(this.storedMachine!=null){
            //update positions of after segments
            var segmentIds = this.storedMachine.segmentIds;
            var segmentIndex = segmentIds.indexOf(splitSegmentId);
            for(var i=segmentIndex+1;i<segmentIds.length;i++){
                var afterSegmentId = segmentIds[i];
                this.segmentSpritePositions[afterSegmentId] = this.segmentSprites[afterSegmentId].getPosition();
            }
        }

        this.splitSegmentId = null;
        this.splittingSegmentLength = null;
        this.selectedMachineId = null;
        this.storedMachine = null
        this.adjustIndicator();
        cc.AudioEngine.getInstance().playEffect(s_Drop_m4a);
    },

    bringSegment:function(){
        var segmentId = this.readySegmentId;
        var job = this.facility.jobs[this.facility.segments[segmentId].jobId];
        var processingTime = this.facility.segments[segmentId].processingTime;
        var center = cc.pAdd(GAMEPLAY_OFFSET, cc.p((NUM_COLS+0.5) * SLICE_SIZE + PADDING_LOG, processingTime/2 * SLICE_SIZE));
        this.segmentSprites[segmentId] = cc.Sprite.create(WOODS[processingTime]);
        this.segmentSprites[segmentId].setColor(job.color);
        this.segmentSprites[segmentId].setPosition(center);
        this.segmentSprites[segmentId].setOpacity(0);
        this.segmentSprites[segmentId].runAction(cc.FadeIn.create(0.25));
        this.addChild(this.segmentSprites[segmentId]);

        this.segmentSpritePositions[segmentId] = center;
        this.runAction(cc.Sequence.create(cc.DelayTime.create(0.25), cc.CallFunc.create(function(){
            this.setTouchEnabled(true);
        }, this)));
    },

    enableMachine:function(machineId){
        this.facility.machines[machineId].enabled = true;
        var sprite = this.lightSprites[machineId];
        var center = sprite.getPosition();
        sprite.removeFromParent(true);
        sprite = cc.Sprite.create(s_Light);
        sprite.setColor(S_COLOR.GREEN);
        sprite.setPosition(center);
        this.addChild(sprite);
        this.lightSprites[machineId] = sprite;
    },

    disableMachine:function(machineId){
        this.facility.machines[machineId].enabled = false;
        var sprite = this.lightSprites[machineId];
        var center = sprite.getPosition();
        sprite.removeFromParent(true);
        sprite = cc.Sprite.create(s_Light);
        sprite.setColor(S_COLOR.RED);
        sprite.setPosition(center);
        this.addChild(sprite);
        this.lightSprites[machineId] = sprite;
    },

    adjustIndicator:function(){
        var deadline = this.facility.deadline;
        var h = 0;
        for(var i in this.facility.assignments){
            var tmp = 0;
            var segments = this.facility.assignments[i];
            for(var j=0; j<segments.length; j++)
                tmp += this.facility.segments[segments[j]].processingTime;
            h = Math.max(h,tmp);
        }

        //remove current indicator sprites
        for(var i=0;i<this.indicatorSprites.length;i++){
            this.indicatorSprites[i].removeFromParent(true);
        }

        this.indicatorSprites = [];

        //create green indicators
        for(var i=0;i<h;i++){
            var sprite = cc.Sprite.create(s_Indicator);
            sprite.setColor(S_COLOR.GREEN);
            sprite.setPosition(cc.pAdd(GAMEPLAY_OFFSET,cc.p(-4,(i+0.5)*SLICE_SIZE)));
            this.addChild(sprite);
        }

        //create yellow indicators
        for(var i=h;i<this.facility.deadline;i++){
            var sprite = cc.Sprite.create(s_Indicator);
            sprite.setColor(S_COLOR.YELLOW);
            sprite.setPosition(cc.pAdd(GAMEPLAY_OFFSET,cc.p(-4,(i+0.5)*SLICE_SIZE)));
            this.addChild(sprite);
        }
    },

    onPauseClicked:function(){
        // disable touch
        this.setTouchEnabled(false);
        // this will pause all schedulers and actions associated with the PreemptiveGameWorld layer
        this.pauseSchedulerAndActions();
        // disable the pause button
        this.pauseButton.setEnabled(false);
        // display the pause popup
        this.showPausePopup();
    },

    onTouchMoved:function(touches, event){
        var touch = cc.p(touches[0].getLocation().x, touches[0].getLocation().y);
        this.currentTouchPos[0] = touches[0].getLocation().x;
        this.currentTouchPos[1] = touches[0].getLocation().y;
    },

    showPausePopup:function(){
        // create a black semi-transparent layer
        this.popup = cc.LayerColor.create(cc.c3b(0, 0, 0), this.screenSize.width, this.screenSize.height);
        // set opacity so that it is not visible
        this.popup.setOpacity(0);
        // fade it in
        this.popup.runAction(cc.FadeTo.create(0.25, 196));
        this.addChild(this.popup, 10);

        // create the continue button
        var continueButton = cc.MenuItemLabel.create(cc.LabelTTF.create("Continue", "Shantell Sans", 32), this.onContinueClicked, this);
        continueButton.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.6));

        // create the restart button
        var restartButton = cc.MenuItemLabel.create(cc.LabelTTF.create("Restart", "Shantell Sans", 32), this.onRestartClicked, this);
        restartButton.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.5));

        // create the menu button
        var menuButton = cc.MenuItemLabel.create(cc.LabelTTF.create("Menu", "Shantell Sans", 32), this.onMenuClicked, this);
        menuButton.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.4));

        // create the pause menu with the above three button
        var pauseMenu = cc.Menu.create(continueButton, restartButton, menuButton);
        pauseMenu.setPosition(cc.POINT_ZERO);
        this.popup.addChild(pauseMenu);

        // title to inform the user which popup this is
        var pausedLabel = cc.LabelTTF.create("Game Paused", "Shantell Sans", 52);
        pausedLabel.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.75));
        this.popup.addChild(pausedLabel);
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    },

    showGameWonPopup:function(){
        //increase game level
        preemptiveLevel++;
        var allStagesCleared = false;
        if(preemptiveLevel>maxLevel){
            preemptiveLevel = 1;
            allStagesCleared = true;
        }
        //set cookie in 365 days
        setCookie('preemptiveLevel',preemptiveLevel,365);

        // create a black semi-transparent layer
        this.popup = cc.LayerColor.create(cc.c3b(0, 0, 0), this.screenSize.width, this.screenSize.height);
        // set opacity so that it is not visible
        this.popup.setOpacity(0);
        // fade it in
        this.popup.runAction(cc.FadeTo.create(0.25, 196));
        this.addChild(this.popup, 10);

        // create the next button
        var nextButton = cc.MenuItemLabel.create(cc.LabelTTF.create("Next #"+preemptiveLevel, "Shantell Sans", 32), this.onNextClicked, this);
        nextButton.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.5));

        // create the restart button
        var restartButton = cc.MenuItemLabel.create(cc.LabelTTF.create("Restart", "Shantell Sans", 32), this.onRestartClicked, this);
        restartButton.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.4));

        // create the menu button
        var menuButton = cc.MenuItemLabel.create(cc.LabelTTF.create("Menu", "Shantell Sans", 32), this.onMenuClicked, this);
        menuButton.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.3));

        // create the pause menu with the above three button
        var gameWonMenu = cc.Menu.create(nextButton, restartButton, menuButton);
        gameWonMenu.setPosition(cc.POINT_ZERO);
        this.popup.addChild(gameWonMenu);

        // title to inform the user which popup this is
        var gameWonLabel = cc.LabelTTF.create(allStagesCleared ? "All Stages Cleared!" : "You Win", "Shantell Sans", 52);
        gameWonLabel.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.75));
        this.popup.addChild(gameWonLabel);

        var cMaxLabel = cc.LabelTTF.create("Max Completion: " + this.facility.cMax(), "Shantell Sans", 20);
        cMaxLabel.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.67));
        // animate it with a nice heart beat effect to draw the user's attention
        cMaxLabel.runAction(cc.Sequence.create(cc.DelayTime.create(0.5),
            cc.EaseSineIn.create(cc.ScaleTo.create(0.25, 1.1)),
            cc.EaseSineOut.create(cc.ScaleTo.create(0.25, 1))));

        // add a label to show the final log
        var cSumLabel = cc.LabelTTF.create("Total Completion: " + this.facility.cSum(), "Shantell Sans", 20);
        cSumLabel.setPosition(cc.p(this.screenSize.width*0.5, this.screenSize.height*0.62));
        // animate it with a nice heart beat effect to draw the user's attention
        cSumLabel.runAction(cc.Sequence.create(cc.DelayTime.create(0.5),
            cc.EaseSineIn.create(cc.ScaleTo.create(0.25, 1.1)),
            cc.EaseSineOut.create(cc.ScaleTo.create(0.25, 1))));

        this.popup.addChild(cMaxLabel);
        this.popup.addChild(cSumLabel);
        cc.AudioEngine.getInstance().playEffect(s_Win_m4a);
    },

    onContinueClicked:function(){
        // remove the popup
        this.popup.removeFromParent(true);
        this.popup = null;

        // resume PreemptiveGameWorld's schedulers and actions
        this.resumeSchedulerAndActions();
        // enable touch
        this.setTouchEnabled(true);
        // enable pause button
        this.pauseButton.setEnabled(true);
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    },

    onNextClicked:function(){
        // replace the scene with a new instance of NonPreemptiveGameWorldScene...and do this with a transition
        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(0.5, new PreemptiveGameWorldScene()));
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    },

    onRestartClicked:function(){
        // replace the scene with a new instance of PreemptiveGameWorldScene...and do this with a transition
        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(0.5, new PreemptiveGameWorldScene()));
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    },

    onMenuClicked:function(){
        // replace the scene with the MainMenuScene...and do this with a transition
        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(0.5, new MainMenuScene()));
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    }
});

var PreemptiveGameWorldScene = cc.Scene.extend({
    onEnter:function () {
        this._super();
        var layer = new PreemptiveGameWorld();
        layer.init();
        this.addChild(layer);
    }
});
