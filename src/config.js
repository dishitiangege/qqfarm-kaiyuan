/**
 * 配置常量与枚举定义
 */

let CONFIG = {
    serverUrl: 'wss://gate-obt.nqf.qq.com/prod/ws',
    clientVersion: '1.7.0.5_20260306',
    platform: 'qq',              // 平台：qq 或 wx (可通过 --wx 切换为微信)
    os: 'Android',
    heartbeatInterval: 25000,    // 心跳间隔 25 秒
    farmCheckInterval: 1000,    // 自己农场巡查完成后等待间隔 (可通过 --interval 修改, 最低1秒)
    friendCheckInterval: 10000,   // 好友巡查完成后等待间隔 (可通过 --friend-interval 修改, 最低1秒)
    forceLowestLevelCrop: false,  // 开启后固定种最低等级作物（通常是白萝卜），跳过经验效率分析
};

// 设备模板配置
const DEVICE_TEMPLATES = {
    iphone_15_pro: {
        name: 'iPhone 15 Pro',
        os: 'iOS',
        sys_software: 'iOS 18.2.1',
        network: 'wifi',
        memory: '8192',
        device_id: 'iPhone16,2',
    },
    iphone_14_pro: {
        name: 'iPhone 14 Pro',
        os: 'iOS',
        sys_software: 'iOS 17.7.2',
        network: 'wifi',
        memory: '6144',
        device_id: 'iPhone15,3',
    },
    iphone_13: {
        name: 'iPhone 13',
        os: 'iOS',
        sys_software: 'iOS 16.7.2',
        network: 'wifi',
        memory: '4096',
        device_id: 'iPhone14,5',
    },
    samsung_s24: {
        name: 'Samsung Galaxy S24 Ultra',
        os: 'Android',
        sys_software: 'Android 14',
        network: 'wifi',
        memory: '12288',
        device_id: 'SM-S9280',
    },
    xiaomi_14: {
        name: 'Xiaomi 14',
        os: 'Android',
        sys_software: 'Android 14',
        network: 'wifi',
        memory: '12288',
        device_id: '23127PN0CC',
    },
    huawei_mate60: {
        name: 'Huawei Mate 60 Pro',
        os: 'Android',
        sys_software: 'HarmonyOS 4.0',
        network: 'wifi',
        memory: '12288',
        device_id: 'ALN-AL00',
    },
    oneplus_12: {
        name: 'OnePlus 12',
        os: 'Android',
        sys_software: 'Android 14',
        network: 'wifi',
        memory: '16384',
        device_id: 'CPH2581',
    },
    vivo_x100: {
        name: 'vivo X100 Pro',
        os: 'Android',
        sys_software: 'Android 14',
        network: 'wifi',
        memory: '16384',
        device_id: 'V2324A',
    },
};

// 设备信息配置（登录时使用）
let DEVICE_INFO = {
    client_version: CONFIG.clientVersion,
    sys_software: 'Android 12',
    sys_hardware: 'ALN-AL10',
    telecom_oper: '',
    network: 'wifi',
    screen_width: 1080,
    screen_height: 2400,
    density: 3.0,
    cpu: 'kirin',
    memory: 8192,
    gl_render: 'Mali-G78',
    gl_version: 'OpenGL ES 3.2',
    device_id: 'ALN-AL10',
    android_oaid: '',
    ios_caid: '',
};

// 更新 CONFIG 的函数
function updateConfig(newConfig) {
    if (newConfig) {
        Object.assign(CONFIG, newConfig);
        // 同步更新 DEVICE_INFO 中的 client_version
        if (newConfig.clientVersion) {
            DEVICE_INFO.client_version = newConfig.clientVersion;
        }
    }
}

// 应用设备模板
function applyDeviceTemplate(templateKey) {
    const template = DEVICE_TEMPLATES[templateKey];
    if (template) {
        CONFIG.os = template.os;
        DEVICE_INFO.sys_software = template.sys_software;
        DEVICE_INFO.network = template.network;
        DEVICE_INFO.memory = template.memory;
        DEVICE_INFO.device_id = template.device_id;
        return true;
    }
    return false;
}

// 更新设备信息
function updateDeviceInfo(newDeviceInfo) {
    if (newDeviceInfo) {
        Object.assign(DEVICE_INFO, newDeviceInfo);
    }
}

// 获取当前配置的副本
function getConfig() {
    return { ...CONFIG };
}

// 获取设备信息
function getDeviceInfo() {
    return { ...DEVICE_INFO };
}

// 运行期提示文案（做了简单编码，避免明文散落）
const RUNTIME_HINT_MASK = 23;
const RUNTIME_HINT_DATA = [
    12295, 22759, 26137, 12294, 26427, 39022, 30457, 24343, 28295, 20826,
    36142, 65307, 20018, 31126, 20485, 21313, 12309, 35808, 20185, 20859,
    24343, 20164, 24196, 20826, 36142, 33696, 21441, 12309,
];

// 生长阶段枚举
const PlantPhase = {
    UNKNOWN: 0,
    SEED: 1,
    GERMINATION: 2,
    SMALL_LEAVES: 3,
    LARGE_LEAVES: 4,
    BLOOMING: 5,
    MATURE: 6,
    DEAD: 7,
};

const PHASE_NAMES = ['未知', '种子', '发芽', '小叶', '大叶', '开花', '成熟', '枯死'];

module.exports = {
    CONFIG,
    DEVICE_INFO,
    DEVICE_TEMPLATES,
    PlantPhase,
    PHASE_NAMES,
    RUNTIME_HINT_MASK,
    RUNTIME_HINT_DATA,
    updateConfig,
    getConfig,
    getDeviceInfo,
    applyDeviceTemplate,
    updateDeviceInfo,
};
