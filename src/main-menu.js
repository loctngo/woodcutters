var MENU_SLICE_SIZE = 32;
var MENU_NUM_COLS = 14;
var MENU_NUM_ROWS = 20;

var MainMenu = cc.Layer.extend({
    screenSize:null,
    init:function () {
        this._super();
        // preload audio
        cc.AudioEngine.getInstance().preloadEffect(s_Swipe_m4a);
        cc.AudioEngine.getInstance().preloadEffect(s_Chop_m4a);
        cc.AudioEngine.getInstance().preloadEffect(s_Drop_m4a);
        cc.AudioEngine.getInstance().preloadEffect(s_Select_m4a);
        cc.AudioEngine.getInstance().preloadEffect(s_Beep_m4a);
        cc.AudioEngine.getInstance().preloadEffect(s_Start_m4a);
        cc.AudioEngine.getInstance().preloadEffect(s_Win_m4a);

        this.screenSize = cc.Director.getInstance().getWinSize();

        // create a coloured layer as background
        var background = cc.LayerColor.create(cc.c4b(25, 0, 51, 255), this.screenSize.width, this.screenSize.height);
        this.addChild(background);

        // create a label to display the name of the game
        var titleLabel = cc.LabelTTF.create("Wood", "Shantell Sans", 52);
        titleLabel.setColor(T_COLOR.ORANGE);
        titleLabel.setPosition(cc.p(this.screenSize.width * 0.5-92, this.screenSize.height * 0.8));
        this.addChild(titleLabel,1);
        titleLabel = cc.LabelTTF.create("Cutters", "Shantell Sans", 52);
        titleLabel.setColor(S_COLOR.WHITE);
        titleLabel.setPosition(cc.p(this.screenSize.width * 0.5+70, this.screenSize.height * 0.8));
        this.addChild(titleLabel,1);

        // create a play button to move to the game world
        var nonPreemptiveButton = cc.MenuItemSprite.create(cc.Sprite.create(s_Nonpreemtive));
        nonPreemptiveButton.setCallback(this.onNonPreemptivePlayClicked, this);
        nonPreemptiveButton.setPosition(cc.p(this.screenSize.width * 0.3, this.screenSize.height * 0.2));

        var preemptiveButton = cc.MenuItemSprite.create(cc.Sprite.create(s_Preemtive));
        preemptiveButton.setCallback(this.onPreemptivePlayClicked, this);
        preemptiveButton.setPosition(cc.p(this.screenSize.width * 0.7, this.screenSize.height * 0.2));

        // create a menu that will contain the button above
        var menu = cc.Menu.create(nonPreemptiveButton,preemptiveButton);
        menu.setPosition(0,0);
        this.addChild(menu, 1);

        this.doAnimation();
        this.schedule(this.doAnimation, 2);

        return true;
    },
    doAnimation:function(){
        var numSlices = Math.round(Math.random() * 30);
        for(var i = 0; i < numSlices; ++i)
        {
            var slice = cc.Sprite.create(s_Menu_Wood);
            slice.setColor(colors[Math.floor(Math.random()*MAX_COLORS)]);
            slice.setPosition(this.getRandomPositionForSlice());
            slice.setScale(0);
            this.addChild(slice);

            var waitBefore = cc.DelayTime.create(Math.random() * 5);
            var scaleUp = cc.EaseBackOut.create(cc.ScaleTo.create(0.125, 1));
            var waitAfter = cc.DelayTime.create(Math.random() * 5);
            var scaleDown = cc.EaseBackIn.create(cc.ScaleTo.create(0.125, 0));
            var removeSelf = cc.RemoveSelf.create(true);
            slice.runAction(cc.Sequence.create(waitBefore, scaleUp, waitAfter, scaleDown, removeSelf));
        }
    },

    getRandomPositionForSlice:function() {
        return cc.p( Math.floor(1 + Math.random() * MENU_NUM_COLS) * MENU_SLICE_SIZE, Math.floor(1 + Math.random() * (MENU_NUM_ROWS+5)) * MENU_SLICE_SIZE );
    },

    onNonPreemptivePlayClicked:function(){
        // ask the director to change the running scene
        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(0.5, new NonPreemptiveGameWorldScene()));
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    },

    onPreemptivePlayClicked:function(){
        // ask the director to change the running scene
        cc.Director.getInstance().replaceScene(cc.TransitionFade.create(0.5, new PreemptiveGameWorldScene()));
        cc.AudioEngine.getInstance().playEffect(s_Select_m4a);
    }
});

var MainMenuScene = cc.Scene.extend({
    onEnter:function () {
        this._super();
        var layer = new MainMenu();
        layer.init();
        this.addChild(layer);
    }
});
