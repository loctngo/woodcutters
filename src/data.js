var nonpreemptiveLevel = null;
var preemptiveLevel = null;
var maxLevel = 25;
var INF = 1000000000;

// maximum number of colours we can use
var MAX_COLORS = 15;

var S_COLOR = {
    WHITE: cc.c3b(255, 255, 255),
    RED: cc.c3b(255, 0, 0),
    YELLOW: cc.c3b(255, 255, 0),
    GREEN: cc.c3b(0, 255, 0),
    GRAY: cc.c3b(90, 90, 90)
}

var T_COLOR = {
    ORANGE: cc.c3b(255, 160, 0),
    GOLDEN_ROD: cc.c3b(225,183,76),
    OLIVE: cc.c3b(166,166,76),
    SADDLE_BROWN: cc.c3b(206,102,28),
    PURPLE: cc.c3b(185, 19, 188),
    MAROON: cc.c3b(183,111,111),
    CRIMSON: cc.c3b(220,20,60),
    MAGENTA: cc.c3b(249,19,188),
    INDIGO: cc.c3b(165,127,192),
    GRAY: cc.c3b(150, 150, 150),
    SLATE_GRAY: cc.c3b(169,178,188),
    GREEN: cc.c3b(0, 170, 0),
    MINT_GREEN: cc.c3b(120,156,119),
    BLUE: cc.c3b(0, 114, 230),
    CORN_FLOWER_BLUE: cc.c3b(146,180,242)
};

// var colors = [
//     T_COLOR.ORANGE,
//     T_COLOR.PURPLE,
//     T_COLOR.GREEN,
//     T_COLOR.BLUE,
//     T_COLOR.GRAY,
//     T_COLOR.MAGENTA,
//     T_COLOR.OLIVE,
//     T_COLOR.MAROON,
//     T_COLOR.SADDLE_BROWN,
//     T_COLOR.SLATE_GRAY,
//     T_COLOR.INDIGO,
//     T_COLOR.MINT_GREEN,
//     T_COLOR.CRIMSON,
//     T_COLOR.CORN_FLOWER_BLUE,
//     T_COLOR.GOLDEN_ROD
// ];

var colors = [
    T_COLOR.GRAY,
    T_COLOR.SLATE_GRAY,
    T_COLOR.GREEN,
    T_COLOR.MINT_GREEN,
    T_COLOR.BLUE,
    T_COLOR.CORN_FLOWER_BLUE,
    T_COLOR.ORANGE,
    T_COLOR.GOLDEN_ROD,
    T_COLOR.OLIVE,
    T_COLOR.SADDLE_BROWN,
    T_COLOR.PURPLE,
    T_COLOR.MAROON,
    T_COLOR.CRIMSON,
    T_COLOR.MAGENTA,
    T_COLOR.INDIGO
];

var scenes = [
    null,
    {
        nJobs: 6,
        pMax: 6,
        cMax: 9
    },
    {
        nJobs: 6,
        pMax: 7,
        cMax: 9
    },
    {
        nJobs: 6,
        pMax: 8,
        cMax: 9
    },
    {
        nJobs: 6,
        pMax: 9,
        cMax: 9
    },
    {
        nJobs: 7,
        pMax: 6,
        cMax: 9
    },
    {
        nJobs: 7,
        pMax: 7,
        cMax: 9
    },
    {
        nJobs: 7,
        pMax: 8,
        cMax: 9
    },
    {
        nJobs: 7,
        pMax: 9,
        cMax: 9
    },
    {
        nJobs: 8,
        pMax: 6,
        cMax: 9
    },
    {
        nJobs: 8,
        pMax: 7,
        cMax: 9
    },
    {
        nJobs: 8,
        pMax: 8,
        cMax: 9
    },
    {
        nJobs: 8,
        pMax: 9,
        cMax: 9
    },
    {
        nJobs: 9,
        pMax: 6,
        cMax: 9
    },
    {
        nJobs: 9,
        pMax: 7,
        cMax: 9
    },
    {
        nJobs: 9,
        pMax: 8,
        cMax: 9
    },
    {
        nJobs: 9,
        pMax: 9,
        cMax: 9
    },
    {
        nJobs: 10,
        pMax: 6,
        cMax: 9
    },
    {
        nJobs: 10,
        pMax: 7,
        cMax: 9
    },
    {
        nJobs: 10,
        pMax: 8,
        cMax: 9
    },
    {
        nJobs: 10,
        pMax: 9,
        cMax: 9
    },
    {
        nJobs: 11,
        pMax: 9,
        cMax: 9
    },
    {
        nJobs: 12,
        pMax: 9,
        cMax: 9
    },
    {
        nJobs: 13,
        pMax: 9,
        cMax: 9
    },
    {
        nJobs: 14,
        pMax: 9,
        cMax: 9
    },
    {
        nJobs: 15,
        pMax: 9,
        cMax: 9
    },
]

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}