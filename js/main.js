const version = 'v1.0.0-beta'

let client
let username
let connecting
let serverList
let closed
let reconnectTimes
let userMap
let heartbeatInterval
let connectionInfo = {}

// ws连接地址
const host = '127.0.0.1'
const port = 1025
const url = '/xechat'

$(() => {
    helpCmdHandler()
    $('#inputArea').on('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const content = $('#inputArea').val()
            if (content) {
                if (content.startsWith('#')) {
                    showConsole('<div>' + content + '</div>')
                    commandHandler(content.substring(1))
                } else {
                    sendUserMsg(content)
                }

                $('#inputArea').val('')
                gotoConsoleLow(true)
            }
        }
    })
})

/**
 * 命令处理
 *
 * @param cmdStr
 */
function commandHandler(cmdStr) {
    const cmd = cmdStr.split(' ')[0]
    let params = ''
    if (cmdStr.length > cmd.length + 1) {
        params = cmdStr.substring(cmd.length + 1)
    }

    switch (cmd) {
        case 'clean':
            cleanConsole()
            showConsole('<div>粉骨碎身浑不怕，要留清白在人间。</div>')
            return
        case 'showServer':
            showServerCmdHandler(params)
            return
        case 'showStatus':
            showStatusCmdHandler()
            return
        case 'setStatus':
            setStatusCmdHandler(params)
            return
        case 'login':
            loginCmdHandler(params)
            return
        case 'help':
            helpCmdHandler()
            return
        case 'exit':
            if (checkSocket()) {
                client.close()
                closed = true
            }
            return
    }

    showConsole('<div>命令不存在！</div>')
}

/**
 * 显示可用状态值
 */
function showStatusCmdHandler() {
    showConsole('<div>状态值：0.工作中 1.摸鱼中</div>')
}

/**
 * 设置状态值
 */
function setStatusCmdHandler(params) {
    if (!checkSocket()) {
        showConsole('<div>请先登录！</div>')
        return
    }

    if (!params || params < 0 || params > 1) {
        showConsole('<div>非法的状态值！</div>')
        return
    }

    let status = params == 0 ? 'WORKING' : 'FISHING'
    const msg = {
        "action": "SET_STATUS",
        "body": status
    }

    client.send(JSON.stringify(msg))
    showConsole('<div>状态值设置成功！</div>')
}

/**
 * 查看鱼塘列表命令处理
 *
 * @param params
 */
function showServerCmdHandler(params) {
    showConsole('<div>正在查询鱼塘列表...</div>')

    updateServerList()

    if (serverList && serverList.length > 0) {
        let str = '<div>&nbsp;|&nbsp;&nbsp;编号&nbsp;&nbsp;|&nbsp;&nbsp;鱼塘&nbsp;&nbsp;|</div>'
        for (let i = 0; i < serverList.length; i++) {
            str += '<div>&nbsp;|&nbsp;&nbsp;' + i + '&nbsp;&nbsp;|&nbsp;&nbsp;'+ serverList[i].name + '&nbsp;&nbsp;|</div>'
        }
        showConsole(str)
    } else {
        showConsole('<div>没有鱼塘！</div>')
    }
}

function updateServerList() {
    $.ajaxSetup({
        async: false
    })

    $.get('server_list.json', resp => {
        serverList = resp
    })
}

/**
 * 登录命令处理
 *
 * @param params
 */
function loginCmdHandler(params) {
    if (connecting) {
        showConsole('<div>请等待上一个连接完成！</div>')
        return
    }

    if (checkSocket()) {
        showConsole('<div>已是登录状态！</div>')
        return
    }

    let uname = params.split(' ')[0]
    if (uname) {
        username = uname
    } else {
        username = localStorage.getItem('xechat-username')
    }
    if (!username) {
        showConsole('昵称不能为空！')
        return
    }

    let h = getCmdValue(params, 'h')
    let p = getCmdValue(params, 'p')
    const serverNum = getCmdValue(params, 's')

    if (!h && !p) {
        const cacheHost = localStorage.getItem('xechat-host')
        if (cacheHost) {
            h = cacheHost.split(':')[0]
            p = cacheHost.split(':')[1]
        }
    } else {
        if (!h) {
            h = host
        }
        if (!p) {
            p = port
        }
    }

    if (serverNum) {
        updateServerList()
        if (serverList && serverList.length > 0) {
            if (serverNum < 0 || serverNum >= serverList.length) {
                showConsole('<div>非法的鱼塘编号！</div>')
                return
            }

            const server = serverList[serverNum]
            h = server.ip
            p = server.port
        } else {
            showConsole('<div>没有鱼塘！</div>')
            return
        }
    }

    if (params.includes(' -c')) {
        localStorage.removeItem('xechat-host')
        h = host
        p = port
    }

    connecting = true
    showConsole('<div>正在连接服务器...</div>')
    client = createClient(h, p, url, false)
}

/**
 * 帮助命令处置
 */
function helpCmdHandler() {
    let str = '' +
        '命令列表 & 触发命令前缀 #<br/>' +
        '· #login：登录，#login {昵称} [-s {鱼塘编号} -h {服务端IP} -p {服务端端口} -c (清理缓存)]<br/>' +
        '· #showServer：鱼塘列表<br/>' +
        '· #showStatus：查看可用状态值<br/>' +
        '· #setStatus：设置当前状态，#setStatus {状态值}<br/>' +
        '· #exit：退出<br/>' +
        '· #clean：清屏<br/>' +
        '· #help：帮助<br/>' +
        ' > Tips: "{ }"表示输入参数占位符，"[ ]"内的参数为可选参数，所有参数均以空格分隔。<br/>' +
        '<br/>' +
        ' <b>Version ' + version + '</b><br/>' +
        ' <br/><div class="help-url">&nbsp;&nbsp;&nbsp;&nbsp;<a target="_blank" href="https://github.com/anlingyi/xechat-web">[开源]</a> <a target="_blank" href="https://xeblog.cn/?tag=xechat-idea">[更多]</a></div><br/>'

    showConsole('<div class="help">' + str +'</div>')
}

/**
 * 获取命令参数值
 *
 * Author：ChatGPT
 * @param str
 * @param paramName
 * @returns {*|null}
 */
function getCmdValue(str, paramName) {
    const regex = new RegExp(`-${paramName} ([^\\s]+)`)
    const match = str.match(regex)
    return match ? match[1] : null
}

/**
 * 创建WebSocket连接
 *
 * @param url
 * @param port
 * @param url
 * @param reconnected
 * @returns {WebSocket}
 */
function createClient(host, port, url, reconnected) {
    const socket = new WebSocket('ws://' + host + ':'  + port + url)
    let timeoutFlag
    const timeout = setTimeout(() => {
        clearTimeout(timeout)
        if (connecting && !checkSocket()) {
            timeoutFlag = true
            connecting = false
            showConsole('<div>连接服务器超时！</div>')
            socket.close()
        }
    }, 15000)

    socket.onopen = e => {
        // 心跳检测动作
        heartbeatAction(15)
        // 登录动作
        loginAction(username, 'FISHING', '', reconnected)

        localStorage.setItem('xechat-host', host + ':' + port)
        connecting = false
        reconnectTimes = 0

        connectionInfo = {
            'host': host,
            'port': port
        }
    }

    socket.onclose = e => {
        clearInterval(heartbeatInterval)
        if (timeoutFlag) {
            return
        }

        connecting = false
        showConsole('<div>已断开连接！</div>')

        if (!closed) {
            if (reconnectTimes++ < 3) {
                const timeout = setTimeout(() => {
                    clearTimeout(timeout)
                    showConsole('<div>正在重新连接服务器...</div>')
                    connecting = true
                    client = createClient(host, port, url, true)
                }, reconnectTimes * 1000)
                return
            }
        }

        showTitle('控制台')
    }

    socket.onmessage = e => {
        closed = false
        msgHandler(JSON.parse(e.data))
    }

    socket.onerror = e => {
        if (timeoutFlag) {
            return
        }

        showConsole('<dvi>你干嘛~ 哎哟！</dvi>')
    }

    return socket
}

function checkSocket() {
    return client && client.readyState === WebSocket.OPEN
}

/**
 * 发送心跳
 *
 * @param sec 间隔秒
 */
function heartbeatAction(sec) {
    const msg = {
        "action": "HEARTBEAT"
    }

    heartbeatInterval = setInterval(() => {
        if (checkSocket()) {
            client.send(JSON.stringify(msg))
        } else {
            clearInterval(heartbeatInterval)
        }
    }, sec * 1000)
}

/**
 * 登录动作
 *
 * @param username 昵称
 * @param status 状态
 * @param token 管理员令牌
 * @param reconnected 重连标识
 */
function loginAction(username, status, token, reconnected) {
    if (!checkSocket()) {
        return
    }

    const msg = {
        "action": "LOGIN",
        "body": {
            "username": username,
            "status": status,
            "reconnected": reconnected,
            "pluginVersion": "",
            "token": token,
            "uuid": getUUID(),
            "platform": "WEB"
        }
    }

    client.send(JSON.stringify(msg))
}

/**
 * 发送用户消息
 *
 * @param content
 */
function sendUserMsg(content) {
    if (!checkSocket()) {
        showConsole('<div>请先登录！</div>')
        return
    }

    const msg = {
        "action": "CHAT",
        "body": {
            "content": content,
            "msgType": "TEXT",
            "toUsers": []
        }
    }

    client.send(JSON.stringify(msg))
}

/**
 * 消息处理
 *
 * @param msg
 */
function msgHandler(msg) {
    const type = msg.type
    msg = JSON.parse(escapeHtml(JSON.stringify(msg)))
    switch (type) {
        case 'SYSTEM':
            systemMsgHandler(msg)
            break
        case 'USER':
            userMsgHandler(msg)
            break
        case 'HISTORY_MSG':
            historyMsgHandler(msg)
            break
        case 'STATUS_UPDATE':
            statusUpdateMsgHandler(msg)
            break
        case 'USER_STATE':
            userStateMsgHandler(msg)
            break
        case 'ONLINE_USERS':
            onlineUserMsgHandler(msg)
            break
    }
}

/**
 * 系统消息处理
 *
 * @param msg
 */
function systemMsgHandler(msg) {
    showConsole('<div class="sysmsg">[' + msg.time + '] 系统消息：' + msg.body + '</div>')
}

/**
 * 用户消息处理
 *
 * @param msg
 */
function userMsgHandler(msg) {
    const user = msg.user
    const region = showUserRegion(user.region)
    const role = showRole(user.role)
    const status = showUserStatus(user.status)
    const platform = user.platform === 'WEB' ? ' ༄' : ' ♨'
    const body = msg.body
    const type = body.msgType
    let content = ''
    if (type === 'IMAGE') {
        let downloadUrl = 'http://' + connectionInfo.host + ':' + connectionInfo.port + '/download/' + body.content
        content = '[<a title="查看图片" target="_blank" href="' + downloadUrl + '">查看图片</a>]'
    } else {
        content = body.content
    }

    showConsole('<div class="usermsg"><b>[' + msg.time + '] [' + region + '] '
        + user.username + ' (' + status + ')' + platform + role + '：</b>' + content + '</div>')
}

/**
 * 历史消息处理
 *
 * @param msg
 */
function historyMsgHandler(msg) {
    showConsole('<div>正在加载历史消息...<div>')
    let msgList = msg.body.msgList
    msgList.forEach(msg => msgHandler(msg))
    showConsole('<div>------以上是历史消息------<div>')
}

/**
 * 用户状态变更消息处理
 *
 * @param msg
 */
function statusUpdateMsgHandler(msg) {
    if (!userMap) {
        userMap = new Map
    }
    userMap.set(msg.user.id, msg.user)
}

/**
 * 用户上下线消息处理
 *
 * @param msg
 */
function userStateMsgHandler(msg) {
    const user = msg.body.user
    if (msg.body.state === 'ONLINE') {
        userMap.set(user.id, user)
    } else {
        userMap.delete(user.id)
    }

    flushUserTotal()
}

/**
 * 在线用户列表消息处理
 *
 * @param msg
 */
function onlineUserMsgHandler(msg) {
    localStorage.setItem('xechat-username', username)

    userMap = new Map
    msg.body.userList.forEach(user => {
        userMap.set(user.id, user)
    })

    flushUserTotal()
}

/**
 * 刷新在线用户数
 */
function flushUserTotal() {
    showTitle('Debug(' + userMap.size  + ')')
}

/**
 * 标题显示
 *
 * @param content
 */
function showTitle(content) {
    $('#title').text(content)
}

/**
 * 用户地区显示
 *
 * @param region
 * @returns {string}
 */
function showUserRegion(region) {
    let str = '未知'
    if (region.city) {
        str = region.city
    } else if (region.province) {
        str = region.province
    }
    return str === '未知' ? '中国' : str
}

/**
 * 用户状态显示
 *
 * @param status
 * @returns {string}
 */
function showUserStatus(status) {
    switch (status) {
        case 'FISHING':
            return '鱼'
        case 'WORKING':
            return '工'
        case 'PLAYING':
            return '戏'
    }
    return '鱼'
}

/**
 * 用户角色显示
 *
 * @param role
 * @returns {string}
 */
function showRole(role) {
    switch (role) {
        case 'ADMIN':
            return ' ☆'
    }
    return ''
}

/**
 * 显示内容到控制台
 *
 * @param content
 */
function showConsole(content) {
    $('#console').append(content)
    gotoConsoleLow()
}

/**
 * 清理控制台
 */
function cleanConsole() {
    $('#console').html('')
}

/**
 * 跳到控制台底部
 *
 * @param force 是否强制跳转
 */
function gotoConsoleLow(force) {
    const e = document.getElementById('console')
    const scrollHeight = e.scrollHeight
    const clientHeight = e.clientHeight
    const scrollTop = e.scrollTop
    const distanceToBottom = scrollHeight - clientHeight - scrollTop

    if (force || distanceToBottom <= 50) {
        e.scrollTop = scrollHeight
    }
}

/**
 * 获取当前UUID
 *
 * @returns {string}
 */
function getUUID() {
    let uuid = localStorage.getItem('xechat-uuid')
    if (!uuid) {
        uuid = generateUUID()
        localStorage.setItem('xechat-uuid', uuid)
    }
    return uuid
}

/**
 * 生成UUID
 *
 * Author: ChatGPT
 * @returns {string}
 */
function generateUUID() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const data = new Uint32Array(4)
        window.crypto.getRandomValues(data)
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (data[0] & 0x3fffffff + (data[1] & 0x0fffffff) * 0x10000000) % 16 | 0
            data[0] >>= 4
            data[1] >>= 4
            return (c === 'x' ? r : (r & 0x7 | 0x8)).toString(16)
        })
    } else {
        console.warn('浏览器不支持crypto API，使用备用方法生成UUID')
        // 在不支持crypto API的环境中使用备用方法
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
    }
}

/**
 * 转义防注入
 *
 * @param html
 * @returns {string}
 */
function escapeHtml(html) {
    const element = document.createElement('div')
    element.appendChild(document.createTextNode(html))
    return element.innerHTML
}


