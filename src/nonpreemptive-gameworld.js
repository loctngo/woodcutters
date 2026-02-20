/*
  screen width = 480px
  screen height = 800px
*/
var MACHINE_SCALE = 0.08;

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

function NonPreemptiveSchedule(){
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

    this.unassignedJobIds = [];

    /*
    ** machineId -> [jobId]
    */
    this.assignments = {};

    /*
    ** jobId -> {processingTime: ?, color:?}
    */
    this.jobs = {};

    this.nJobs = function(){
        return Object.keys(this.jobs).length;
    };

    this.cloneAssignedJobIds = function(machineId){
        var jobIds = [];
        var assignedJobIds = this.assignments[machineId];
        for(var i=0;i<assignedJobIds.length;i++)
            jobIds.push(assignedJobIds[i]);
        return jobIds;
    }

    this.getAssignedMachineId = function(jobId){
        for(var machineId in this.assignments){
            if(this.assignments[machineId].indexOf(jobId)!=-1)
                return machineId;
        }
        return null;
    };

    this.getProcessedTime = function(machineId){
        var processedTime = 0;
        for(var jobId in this.jobs)
            if(this.assignments[machineId].indexOf(jobId)!=-1)
                processedTime += this.jobs[jobId].processingTime;

        return processedTime;
    };

    this.nextAvailableTime = function(machineId,processingTime){
        var processedTime = this.getProcessedTime(machineId);
        if(this.deadline-processedTime >= processingTime)
            return processedTime;
        return -1;
    };

    this.cSum = function(){
        var cSum = 0;
        for(var machineId in this.machines){
            var c = 0;
            for(var i=0;i<this.assignments[machineId].length;i++){
                var jobId = this.assignments[machineId][i];
                c += this.jobs[jobId].processingTime;
                cSum += c;
            }
        }
        return cSum;
    };

    this.cMax = function(){
        var cMax = 0;
        for(var machineId in this.machines){
            var c = 0;
            for(var i=0;i<this.assignments[machineId].length;i++){
                var jobId = this.assignments[machineId][i];
                c += this.jobs[jobId].processingTime;
                cMax = Math.max(cMax, c);
            }
        }
        return cMax;
    };
};

var NonPreemptiveGameWorld = cc.Layer.extend({

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
    //job sprites
    jobSprites: null,
    //outline sprite showing when user is dragging the job sprite
    //over the available machine column
    outlineJobSprite: null,
    //ready job id on the preview section
    readyJobId: null,
    //selected job id
    selectedJobId: null,
    //positons of all sprites
    jobSpritePositions:null,
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
        nonpreemptiveLevel = getCookie('nonpreemptiveLevel') == "" ? 1 : parseInt(getCookie('nonpreemptiveLevel'));

        var schedule = randomGenerateNonpreemptive(scenes[nonpreemptiveLevel].nJobs, scenes[nonpreemptiveLevel].pMax);

        this.facility = new NonPreemptiveSchedule();

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
        this.facility.unassignedJobIds = [];
        for(var i=0;i<jobs.length;i++){
            this.facility.jobs[i] = {
                processingTime: jobs[i],
                color: colors[i]
            };

            this.facility.unassignedJobIds.push(i.toString());
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
        gamePlayFrame.drawPoly(vertices, cc.c4f(0.9, 0.9, 0.9, 1), 2, cc.c4f(0.6, 0.6, 0.6, 1));
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
        var levelLabel = cc.LabelTTF.create("#"+nonpreemptiveLevel, "Shantell Sans", 30);
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

        var jobs = this.facility.jobs;
        this.jobSprites = {};
        this.jobSpritePositions = {};

        // create sprites
        var jobId = 0;
        var processingTime = jobs[jobId].processingTime;
        var center = cc.pAdd(GAMEPLAY_OFFSET, cc.p((NUM_COLS+0.5) * SLICE_SIZE + PADDING_LOG, processingTime/2 * SLICE_SIZE))
        var sprite = cc.Sprite.create(WOODS[processingTime]);
        sprite.setColor(jobs[jobId].color);
        sprite.setPosition(center);
        this.jobSprites[jobId] = sprite;

        this.jobSpritePositions[jobId] = center;
        this.readyJobId = jobId;
        this.addChild(this.jobSprites[jobId]);

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
            labels[i] = cc.LabelTTF.create("", "Shantell Sans", 62);
            // position the label at the centre of the screen
            labels[i].setPosition(cc.p(this.screenSize.width/2, this.screenSize.height/2-29));
            labels[i].setColor(S_COLOR.GRAY);

            // reduce opacity so that the label is invisible
            labels[i].setOpacity(0);

            // enlarge the label
            labels[i].setScale(5);

            this.addChild(labels[i],1);
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
        this.log = this.facility.unassignedJobIds.length;
        this.logLabel.setString("logs: " + this.log);
        this.cSumLabel.setString("Σ Completion: " + this.facility.cSum() + " ≤ "+this.facility.maxTC, "Shantell Sans", 18);
        // run a simple action so the user knows the log is being added
        // use the ease functions to create a heart beat effect
        this.logLabel.runAction(cc.Sequence.create(cc.EaseSineIn.create(cc.ScaleTo.create(0.125, 1.1)), cc.EaseSineOut.create(cc.ScaleTo.create(0.125, 1))));
        this.cSumLabel.runAction(cc.Sequence.create(cc.EaseSineIn.create(cc.ScaleTo.create(0.125, 1.1)), cc.EaseSineOut.create(cc.ScaleTo.create(0.125, 1))));
        if(this.facility.unassignedJobIds.length == 0 && this.facility.cSum()<=this.facility.maxTC) {
            //disable touching everything else except the dialog
            this.setTouchEnabled(false);
            this.pauseButton.setEnabled(false);
            this.unscheduleAllCallbacks();
            this.runAction(cc.Sequence.create(cc.DelayTime.create(2), cc.CallFunc.create(function () {
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
            var machines = this.facility.machines;
            var jobs = this.facility.jobs;
            for(var jobId in jobs){
                if(this.jobSprites[jobId]!=null &&
                    this.inside(this.jobSprites[jobId],this.initialTouchPos) &&
                    this.inside(this.jobSprites[jobId],this.currentTouchPos)){
                    var processingTime = this.facility.jobs[jobId].processingTime;
                    var center = this.jobSprites[jobId].getPosition();
                    this.jobSprites[jobId].removeFromParent(true);

                    this.jobSprites[jobId] = cc.Sprite.create(WHITES[processingTime]);
                    this.jobSprites[jobId].setColor(this.facility.jobs[jobId].color);
                    this.jobSprites[jobId].setPosition(center);
                    this.addChild(this.jobSprites[jobId],1);

                    this.facility.jobs[jobId].processingTime -= processingTime;
                    //enable machines
                    for(var i in this.facility.machines){
                        if(this.facility.nextAvailableTime(i,processingTime)>-1){
                            this.enableMachine(i);
                        }
                    }
                    this.selectedJobId = jobId;
                    this.runAction(cc.Sequence.create(cc.DelayTime.create(0.01), cc.CallFunc.create(function(){
                        this.unschedule(this.increaseTouchingTime);
                    }, this)));
                    this.facility.jobs[jobId].processingTime += processingTime;
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

        if(this.selectedJobId!=null){
            var jobId = this.selectedJobId;
            var processingTime = this.facility.jobs[jobId].processingTime;
            var offset = cc.pSub(touch,this.currentTouchPos);
            var center = this.jobSprites[this.selectedJobId].getPosition();
            center = cc.pAdd(center, offset);
            this.jobSprites[this.selectedJobId].setPosition(center);
            //check if all of its after jobs were dropped down to the machine

            var machines = this.facility.machines;
            //list of all its after jobs
            var machineId = this.facility.getAssignedMachineId(jobId);

            if(machineId!=null){
                var assignedJobIds = this.facility.assignments[machineId];
                var index = assignedJobIds.indexOf(jobId);
                var afterJobs = assignedJobIds.slice(index+1);

                //drop after jobs to new position
                //update UI
                for(var i=0;i<afterJobs.length;i++){
                    var afterJobId = afterJobs[i];
                    var center = this.jobSprites[afterJobId].getPosition();
                    center = cc.pSub(center,cc.p(0,processingTime*SLICE_SIZE));
                    this.jobSprites[afterJobId].setPosition(center);
                }

                var storedJobIds = this.facility.cloneAssignedJobIds(machineId);
                //we also need to store the state before dropping to restore if if necessary
                this.storedMachine = {
                    machineId: machineId,
                    jobIds: storedJobIds
                };

                //remove the current job out of machine
                this.facility.assignments[machineId].splice(index,1);

                if(this.facility.nextAvailableTime(machineId,processingTime)>-1)
                    this.enableMachine(machineId);
                this.adjustIndicator();
            }

            //check if we drag it into the available machine column
            var selectedMachineId = null;
            for(var i in machines)
                if(machines[i].enabled){
                    var machineCenter = this.machineCenters[i];
                    var distance = cc.pSub(this.jobSprites[jobId].getPosition(), machineCenter);
                    if(Math.abs(distance.x) < SLICE_SIZE/2 &&
                        Math.abs(distance.y) < (NUM_ROWS + processingTime)*SLICE_SIZE/2){
                        selectedMachineId = i;
                        break;
                    }
                }

            if(selectedMachineId!=null){
                var nextTime = this.facility.nextAvailableTime(selectedMachineId,processingTime);
                var outlineJobSpriteCenter = cc.p(machineCenter.x,
                    machineCenter.y + (nextTime + processingTime/2 - NUM_ROWS/2)*SLICE_SIZE);

                if(this.selectedMachineId==null){
                    this.selectedMachineId = selectedMachineId;
                    this.outlineJobSprite = cc.Sprite.create(FRAME_OUTLINES[processingTime]);
                    this.outlineJobSprite.setColor(this.facility.jobs[jobId].color);
                    this.outlineJobSprite.setPosition(outlineJobSpriteCenter);
                    this.addChild(this.outlineJobSprite);
                }
                else{
                    if(this.selectedMachineId!=selectedMachineId){
                        //move to different machine,selectedMachineIdreset the color and position
                        this.selectedMachineId = selectedMachineId;
                        this.outlineJobSprite.setColor(this.facility.jobs[jobId].color);
                        this.outlineJobSprite.setPosition(outlineJobSpriteCenter);
                    }
                }
            }
            else{
                if(this.selectedMachineId != null){
                    this.selectedMachineId = null;
                    this.outlineJobSprite.removeFromParent(true);
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
            this.pushJob(this.selectedMachineId);
            this.updateLog();
            return;
        }

        if(this.selectedJobId!=null){
            var jobId = this.selectedJobId;
            var processingTime = this.facility.jobs[jobId].processingTime;

            //pull the job back to its previous position
            if(this.storedMachine!=null){
                //we need to restore the machine back to previous state
                var machineId = this.storedMachine.machineId;
                var jobIds = this.storedMachine.jobIds;
                //update UI
                var jobIndex = jobIds.indexOf(jobId);
                //pull back the jobs on the top of job
                for(var i=jobIndex+1;i<jobIds.length;i++){
                    var afterJobId = jobIds[i];
                    var center = this.jobSpritePositions[afterJobId];
                    this.jobSprites[afterJobId].setPosition(center);
                }

                var center = this.jobSpritePositions[jobId];
                this.jobSprites[jobId].removeFromParent(true);
                this.jobSprites[jobId] = cc.Sprite.create(WOODS[processingTime]);
                this.jobSprites[jobId].setColor(this.facility.jobs[jobId].color);
                this.jobSprites[jobId].setPosition(center);
                this.addChild(this.jobSprites[jobId]);

                //disable machines
                for(var i in this.facility.machines)
                    this.disableMachine(i);

                //restore the machine data
                this.facility.assignments[machineId] = jobIds;
                this.storedMachine = null;
                this.selectedJobId = null;
                this.adjustIndicator();
                return;
            }

            //put the ready job back to the position
            var center = this.jobSpritePositions[jobId];
            this.jobSprites[jobId].removeFromParent(true);
            this.jobSprites[jobId] = cc.Sprite.create(WOODS[processingTime]);
            this.jobSprites[jobId].setColor(this.facility.jobs[jobId].color);
            this.jobSprites[jobId].setPosition(center);
            this.addChild(this.jobSprites[jobId]);

            this.selectedJobId = null;
            //disable machines
            for(var i in this.facility.machines)
                this.disableMachine(i);
            return;
        }

        //check if we click on the job from the grid
        var machines = this.facility.machines;
        var jobs = this.facility.jobs;
        var jobId = null;

        for(var i in jobs){
            if(this.jobSprites[i]!=null &&
                this.inside(this.jobSprites[i],this.initialTouchPos) &&
                this.inside(this.jobSprites[i],this.currentTouchPos)){
                if(i!=this.readyJobId)
                    jobId = i;
                break;
            }
        }

        if(jobId!=null){
            var processingTime = this.facility.jobs[jobId].processingTime;
            //push the job to the unassigned jobs
            this.jobSprites[jobId].removeFromParent(true);
            delete this.jobSprites[jobId];
            delete this.jobSpritePositions[jobId];

            //pull the after jobs down to the job's bottom
            var machineId = this.facility.getAssignedMachineId(jobId);

            var jobs = this.facility.assignments[machineId];
            var jobIndex = jobs.indexOf(jobId);

            //pull back jobs on the top of the job
            for(var i=jobIndex+1;i<jobs.length;i++){
                var afterJobId = jobs[i];
                var center = this.jobSprites[afterJobId].getPosition();
                center = cc.pSub(center,cc.p(0,processingTime*SLICE_SIZE));
                this.jobSprites[afterJobId].setPosition(center);
                this.jobSpritePositions[afterJobId] = center;
            }

            this.facility.assignments[machineId].splice(jobIndex,1);
            this.facility.unassignedJobIds.push(jobId);

            //show it as the ready job
            if(this.readyJobId == null){
                this.readyJobId = jobId;
                this.bringJob();
            }
            this.adjustIndicator();
            this.updateLog();
            cc.AudioEngine.getInstance().playEffect(s_Whoosh_m4a);
            return;
        }

        // check if we swipe the ready job
        if(this.readyJobId==null)
            return;

        jobId = this.readyJobId;
        var sprite = this.jobSprites[jobId];
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
            var moveJob = 0;

            if(x1!=x0 || y1!=y0){
                var cosa = (x0*x0 - x0*x1) / (Math.abs(x0)*Math.sqrt((x1-x0)*(x1-x0)+(y1-y0)*(y1-y0)));
                if (x0 - x1 > 10 && cosa > 0.8){
                    //swipe left
                    moveJob = -1;
                }
                if (x0 - x1 < -10 && cosa < -0.8){
                    //swipe right
                    moveJob = 1;
                }
            }

            if(moveJob!=0){
                // disable touch so that the subsequent functions have time to execute
                this.setTouchEnabled(false);
                this.initialTouchPos = null;
                this.currentTouchPos = null;
                if(moveJob==1)
                    center = cc.pAdd(center,cc.p(SLICE_SIZE/2,0));
                else
                    center = cc.pSub(center,cc.p(SLICE_SIZE/2,0));
                this.jobSprites[jobId].runAction(cc.Sequence.create(cc.MoveTo.create(0.25,center), cc.FadeOut.create(0.25), cc.RemoveSelf.create(true)));
                delete this.jobSprites[jobId];
                delete this.jobSpritePositions[jobId];

                var index = -1;
                for(var i=0; i<this.facility.unassignedJobIds.length; i++)
                    if(this.facility.unassignedJobIds[i]==this.readyJobId){
                        index = i;
                        break;
                    }

                index -= moveJob;

                if(index == this.facility.unassignedJobIds.length)
                    index = 0;

                if(index == -1)
                    index = this.facility.unassignedJobIds.length-1;

                this.readyJobId = this.facility.unassignedJobIds[index];
                cc.AudioEngine.getInstance().playEffect(s_Swipe_m4a);
                this.runAction(cc.Sequence.create(cc.DelayTime.create(0.5), cc.CallFunc.create(this.bringJob, this)));
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

    pushJob:function(machineId){
        var jobId = this.selectedJobId;
        var processingTime = this.facility.jobs[jobId].processingTime;

        //updating UI
        var center = this.outlineJobSprite.getPosition();
        this.jobSprites[jobId].removeFromParent(true);
        this.outlineJobSprite.removeFromParent(true);

        //disable machines
        for(var i in this.facility.machines)
            this.disableMachine(i);

        var jobSprite = cc.Sprite.create(WOODS[processingTime]);
        jobSprite.setColor(this.facility.jobs[jobId].color);
        jobSprite.setPosition(center);
        this.addChild(jobSprite);
        this.jobSprites[jobId] = jobSprite;
        this.jobSpritePositions[jobId] = center;

        //modify schedule data
        this.facility.assignments[machineId].push(jobId);
        if(this.selectedJobId==this.readyJobId){
            //update new ready job when we are selecting it but not the job from the grid
            var removedIndex = -1;
            var unassignedJobIds = this.facility.unassignedJobIds;
            for(var i=0;i<unassignedJobIds.length;i++)
                if(unassignedJobIds[i]==jobId){
                    removedIndex = i;
                    break;
                }
            this.facility.unassignedJobIds.splice(removedIndex,1);
            if(unassignedJobIds.length>0){
                if(removedIndex==unassignedJobIds.length)
                    this.readyJobId = unassignedJobIds[0];
                else
                    this.readyJobId = unassignedJobIds[removedIndex];
                this.setTouchEnabled(false);
                this.initialTouchPos = null;
                this.currentTouchPos = null;
                this.runAction(cc.Sequence.create(cc.DelayTime.create(0.5), cc.CallFunc.create(this.bringJob, this)));
            }
            else{
                this.readyJobId = null;
            }
        }

        if(this.storedMachine!=null){
            //update positions of after segments
            var jobIds = this.storedMachine.jobIds;
            var jobIndex = jobIds.indexOf(jobId);
            for(var i=jobIndex+1;i<jobIds.length;i++){
                var afterJobId = jobIds[i];
                this.jobSpritePositions[afterJobId] = this.jobSprites[afterJobId].getPosition();
            }
        }

        this.selectedJobId = null;
        this.selectedMachineId = null;
        this.storedMachine = null
        this.adjustIndicator();
        cc.AudioEngine.getInstance().playEffect(s_Drop_m4a);
    },

    bringJob:function(){
        var jobId = this.readyJobId;
        var processingTime = this.facility.jobs[jobId].processingTime;
        var center = cc.pAdd(GAMEPLAY_OFFSET, cc.p((NUM_COLS+0.5) * SLICE_SIZE + PADDING_LOG, processingTime/2 * SLICE_SIZE));
        this.jobSprites[jobId] = cc.Sprite.create(WOODS[processingTime]);
        this.jobSprites[jobId].setColor(this.facility.jobs[jobId].color);
        this.jobSprites[jobId].setPosition(center);
        this.jobSprites[jobId].setOpacity(0);
        this.jobSprites[jobId].runAction(cc.FadeIn.create(0.25));
        this.addChild(this.jobSprites[jobId]);
        this.jobSpritePositions[jobId] = center;
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
            var jobs = this.facility.assignments[i];
            for(var j=0; j<jobs.length; j++)
                tmp += this.facility.jobs[jobs[j]].processingTime;
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
            this.indicatorSprites.push(sprite);
        }

        //create yellow indicators
        for(var i=h;i<this.facility.deadline;i++){
            var sprite = cc.Sprite.create(s_Indicator);
            sprite.setColor(S_COLOR.YELLOW);
            sprite.setPosition(cc.pAdd(GAMEPLAY_OFFSET,cc.p(-4,(i+0.5)*SLICE_SIZE)));
            this.addChild(sprite);
            this.indicatorSprites.push(sprite);
        }
    },

    onPauseClicked:function(){
        // pause the time label if it is animating
        this.timeLabel.pauseSchedulerAndActions();
        // disable touch
        this.setTouchEnabled(false);
        // this will pause all schedulers and actions associated with the NonPreemptiveGameWorld layer
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
        nonpreemptiveLevel++;
        var allStagesCleared = false;
        if(nonpreemptiveLevel>maxLevel){
            nonpreemptiveLevel = 1;
            allStagesCleared = true;
        }
        //set cookie in 365 days
        setCookie('nonpreemptiveLevel',nonpreemptiveLevel,365);

        // create a black semi-transparent layer
        this.popup = cc.LayerColor.create(cc.c3b(0, 0, 0), this.screenSize.width, this.screenSize.height);
        // set opacity so that it is not visible
        this.popup.setOpacity(0);
        // fade it in
        this.popup.runAction(cc.FadeTo.create(0.25, 196));
        this.addChild(this.popup, 10);

        // create the next button
        var nextButton = cc.MenuItemLabel.create(cc.LabelTTF.create("Next #"+nonpreemptiveLevel, "Shantell Sans", 32), this.onNextClicked, this);
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

        // resume NonPreemptiveGameWorld's schedulers and actions
        this.resumeSchedulerAndActions();
        // enable touch
        this.setTouchEnabled(true);
        // enable pause button
        this.pauseButton.setEnabled(true);
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    },

    onNextClicked:function(){
        // replace the scene with a new instance of NonPreemptiveGameWorldScene...and do this with a transition
        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(0.5, new NonPreemptiveGameWorldScene()));
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    },

    onRestartClicked:function(){
        // replace the scene with a new instance of NonPreemptiveGameWorldScene...and do this with a transition
        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(0.5, new NonPreemptiveGameWorldScene()));
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    },

    onMenuClicked:function(){
        // replace the scene with the MainMenuScene...and do this with a transition
        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(0.5, new MainMenuScene()));
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    }
});

var NonPreemptiveGameWorldScene = cc.Scene.extend({
    onEnter:function (level) {
        this._super();
        var layer = new NonPreemptiveGameWorld();
        layer.init();
        this.addChild(layer);
    }
});
