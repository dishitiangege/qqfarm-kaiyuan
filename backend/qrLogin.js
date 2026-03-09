const axios = require('axios');

const ChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Cookie处理工具
class CookieUtils {
    static getValue(cookies, key) {
        if (!cookies) return null;
        if (Array.isArray(cookies)) cookies = cookies.join('; ');
        const match = cookies.match(new RegExp(`(^|;\\s*)${key}=([^;]*)`));
        return match ? match[2] : null;
    }

    static getUin(cookies) {
        const uin = this.getValue(cookies, 'wxuin') || this.getValue(cookies, 'uin') || this.getValue(cookies, 'ptui_loginuin');
        if (!uin) return null;
        return uin.replace(/^o0*/, '');
    }
}

// Hash工具
class HashUtils {
    static hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash += (hash << 5) + str.charCodeAt(i);
        }
        return 2147483647 & hash;
    }
}

// 小程序登录配置
const MiniProgramConfig = {
    farm: {
        name: 'QQ经典农场',
        appid: '1112386029'
    }
};

const QUA = 'V1_HT5_QDT_0.70.2209190_x64_0_DEV_D';

class QRLoginService {
    /**
     * 获取登录二维码
     */
    static async requestLoginCode() {
        try {
            const response = await axios.get('https://q.qq.com/ide/devtoolAuth/GetLoginCode', {
                headers: {
                    'qua': QUA,
                    'host': 'q.qq.com',
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'user-agent': ChromeUA
                }
            });

            const { code, data } = response.data;

            if (+code !== 0) {
                throw new Error('获取登录码失败');
            }

            const qrUrl = `https://h5.qzone.qq.com/qqq/code/${data.code}?_proxy=1&from=ide`;
            
            return {
                code: data.code,
                qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`,
                url: qrUrl
            };
        } catch (error) {
            console.error('Request QRCode Error:', error);
            throw error;
        }
    }

    /**
     * 查询扫码状态
     */
    static async queryStatus(code) {
        try {
            const response = await axios.get(`https://q.qq.com/ide/devtoolAuth/syncScanSateGetTicket?code=${code}`, {
                headers: {
                    'qua': QUA,
                    'host': 'q.qq.com',
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'user-agent': ChromeUA
                }
            });

            if (response.status !== 200) {
                return { status: 'Error' };
            }

            const { code: resCode, data } = response.data;

            if (+resCode === 0) {
                if (+data.ok !== 1) return { status: 'Wait' };
                return { status: 'OK', ticket: data.ticket, uin: data.uin };
            }

            if (+resCode === -10003) return { status: 'Used' };

            return { status: 'Error', msg: `Code: ${resCode}` };
        } catch (error) {
            console.error('Query Status Error:', error);
            throw error;
        }
    }

    /**
     * 获取授权Code
     */
    static async getAuthCode(ticket, appid = '1112386029') {
        try {
            const response = await axios.post('https://q.qq.com/ide/login', {
                appid: appid,
                ticket: ticket
            }, {
                headers: {
                    'qua': QUA,
                    'host': 'q.qq.com',
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'user-agent': ChromeUA
                }
            });

            if (response.status !== 200) return '';

            const { code } = response.data;
            return code || '';
        } catch (error) {
            console.error('Get Auth Code Error:', error);
            return '';
        }
    }

    /**
     * 检查二维码状态（完整流程）
     */
    static async checkStatus(code) {
        const result = await this.queryStatus(code);
        
        let ret = '66';
        let msg = '等待扫码...';
        let authCode = '';
        let uin = '';
        let avatar = '';
        let ticket = '';

        if (result.status === 'Wait') {
            ret = '66';
            msg = '等待扫码...';
        } else if (result.status === 'Used') {
            ret = '65';
            msg = '二维码已失效';
        } else if (result.status === 'OK') {
            ret = '0';
            msg = '登录成功';
            ticket = result.ticket;
            uin = result.uin || '';
            if (uin) {
                avatar = `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=640`;
            }

            // 获取授权Code
            authCode = await this.getAuthCode(ticket, MiniProgramConfig.farm.appid);
        } else if (result.status === 'Error') {
            ret = '65';
            msg = '状态查询错误';
        }

        return { ret, msg, code: authCode, uin, ticket, avatar };
    }
}

module.exports = { QRLoginService };
