/**!
 * youtube-ch-sortable
 * @author 4tuna
 * @license MIT
 */
'use strict'

class CommonFunction {
    static createElementsFromHTML(html) {
        const elem = document.createElement('div')
        elem.innerHTML = html
        return Array.from(elem.children)
    }
}

class YoutubeSortChannel {

    // 登録チャンネル要素を取得
    getSubscriptionsElem() {
        return document.evaluate('//yt-formatted-string[@id="guide-section-title" and contains(text(), "登録チャンネル")]/../..', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotItem(0)
    }

    // 登録チャンネル要素が出現するまで待機
    async waitForLoadSubscriptionsElem() {
        const timeout = 100
        return new Promise(resolve => {
            const watchElem = () => {
                this.getSubscriptionsElem() != null ? resolve() : setTimeout(watchElem, timeout)
            }
            setTimeout(watchElem, timeout)
        })
    }

    // 登録チャンネル項目全件表示ボタン要素を取得
    getExpanderElem() {
        return this.getSubscriptionsElem().querySelector('#expander-item')
    }

    // 登録チャンネル項目を囲む要素の取得
    getSubscriptionsItemsElem() {
        return this.getSubscriptionsElem().querySelector('#items')
    }

    // 登録チャンネル全件表示ボタンを押下し、チャンネル一覧ボタンが出現するまで待機
    showAllSubscriptionsItems() {
        const timeout = 100
        return new Promise(resolve => {
            const expanderElem = this.getExpanderElem()
            if (expanderElem != null) {
                expanderElem.click()
                const waitForElem = () => {
                    const elem = document.evaluate('//yt-formatted-string[contains(text(), "チャンネル一覧")]', this.getSubscriptionsItemsElem(), null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotItem(0)
                    elem != null ? resolve() : setTimeout(waitForElem, timeout)
                }
                setTimeout(waitForElem, timeout)
            }
            else {
                resolve() // 登録チャンネルが7件未満の場合、要素が存在しないため、何もせず続行
            }
        })
    }

    // 画面から登録チャンネル項目情報オブジェクトの配列を取得
    getSubscriptionsItemObjects() {
        let objects = []
        const subscriptionsItemElems = this.getSubscriptionsItemsElem().querySelectorAll('ytd-guide-entry-renderer, .ysc-divider')
        Array.from(subscriptionsItemElems).forEach(elem => {
            if (elem.tagName.toLowerCase() === 'ytd-guide-entry-renderer') {
                // チャンネルの場合
                const aElem = elem.querySelector('a#endpoint')
                const imgElem = aElem.querySelector('yt-icon.guide-icon').getAttribute('disable-upgrade')
                if (imgElem != null) {
                    objects.push({
                        type: 'channel',
                        id: aElem.getAttribute('href'),
                        elem: elem
                    })
                }
            }
            else if (elem.classList.contains('ysc-divider')) {
                // 区切りの場合
                const dividerTitle = elem.querySelector('.ysc-divider-name').innerText
                objects.push({
                    type: 'divider',
                    title: dividerTitle,
                    elem: elem
                })
            }
        })
        return objects
    }

    // ストレージから登録チャンネル順列情報を取得
    loadSortedSubscriptionsItemIds() {
        return new Promise(resolve => {
            chrome.storage.local.get('sorted_subscriptions_item_ids', v => {
                resolve(v.sorted_subscriptions_item_ids)
            })
        })
    }

    // ストレージに登録チャンネル順列情報を保存
    saveSortedSubscriptionsItemIds() {
        const itemIds = this.getSubscriptionsItemObjects().map(obj => {
            if (obj.type === 'channel') {
                return obj.id
            }
            else if(obj.type === 'divider') {
                return '#' + obj.title
            }
        })
        chrome.storage.local.set({ 'sorted_subscriptions_item_ids': itemIds })
    }

    // ストレージに登録チャンネル順列情報が保存されているか
    async existsSortedChannelIds() {
        return (typeof await this.loadSortedSubscriptionsItemIds() !== 'undefined')
    }

    // 順列を調整した登録チャンネル項目要素情報オブジェクトの配列を取得
    async getSortedSubscriptionsItemObjects() {
        const loadedSubscriptionsItemIds = await this.loadSortedSubscriptionsItemIds()
        const subscriptionsItemObjects = this.getSubscriptionsItemObjects()
        let sortedSubscriptionsItemObjects = []
        // 保存されている項目を結果配列に追加
        loadedSubscriptionsItemIds.forEach((id) => {
            if (id.charAt(0) === '/') {
                // 登録チャンネル
                const idx = subscriptionsItemObjects.findIndex(e => e.type === 'channel' && e.id === id)
                if (idx !== -1) {
                    sortedSubscriptionsItemObjects.push({
                        type: 'channel',
                        elem: subscriptionsItemObjects[idx].elem
                    })
                    subscriptionsItemObjects.splice(idx, 1)
                }
            }
            else if(id.charAt(0) === '#') {
                // 区切り
                const strLength = id.length
                sortedSubscriptionsItemObjects.push({
                    type: 'divider',
                    title: id.substring(1, strLength)   // 1文字目(#)以降を取得
                })
            }
        })
        // 保存されていなかった項目情報を結果配列に追加
        subscriptionsItemObjects.forEach((itemObject) => {
            // 登録チャンネル
            if (itemObject.type === 'channel') {
                sortedSubscriptionsItemObjects.push({
                    type: 'channel',
                    elem: itemObject.elem
                })
            }
            // 区切りは追加時に保存され、必ず前述の処理で処理されるため必要なし
        })
        return sortedSubscriptionsItemObjects
    }

    // 登録チャンネル全件表示時に出現する要素を囲む要素の取得
    getExpandedElem() {
        return this.getSubscriptionsElem().querySelector('*[expanded]')
    }

    // ストレージから区切り展開情報を取得
    loadDividerState() {
        return new Promise(resolve => {
            chrome.storage.local.get('divider_state', v => {
                resolve(v.divider_state)
            })
        })
    }

    // ストレージに区切り展開情報を保存
    saveDividerState() {
        const dividerElems = this.getSubscriptionsItemsElem().querySelectorAll('.ysc-divider')
        let dividerState = []
        Array.from(dividerElems).forEach(elem => {
            const dividerTitle = elem.querySelector('.ysc-divider-name').innerText
            dividerState.push({
                title: dividerTitle,
                isMaxmized: window.getComputedStyle(elem.getElementsByClassName('ysc-divider-minimizer')[0]).display === 'block'
            })
        })
        chrome.storage.local.set({ 'divider_state': dividerState })
    }

    // ストレージに区切り展開情報が保存されているか
    async existsDividerState() {
        return (typeof await this.loadDividerState() !== 'undefined')
    }

    // 区切り要素のHTMLを作成して返す
    generateDividerElem(title) {
        const html = `
            <div class="ysc-divider">
                <div class="ysc-divider-content">
                    <span class="ysc-divider-name">${title}</span>
                    <div class="ysc-divider-rigiht_side">
                        <div class="ysc-divider-minimizer"><svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="style-scope yt-icon" style="pointer-events: none; display: block; width: 100%; height: 100%;"><g class="style-scope yt-icon"><polygon points="18.4,14.6 12,8.3 5.6,14.6 6.4,15.4 12,9.7 17.6,15.4 " class="style-scope yt-icon"></polygon></g></svg></div>
                        <div class="ysc-divider-maximizer" style="display:none;"><svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="style-scope yt-icon" style="pointer-events: none; display: block; width: 100%; height: 100%;"><g class="style-scope yt-icon"><path d="M12,15.7L5.6,9.4l0.7-0.7l5.6,5.6l5.6-5.6l0.7,0.7L12,15.7z" class="style-scope yt-icon"></path></g></svg></div>
                        <div class="ysc-divider-remover"><svg height="100%" viewBox="0 0 24 24" width="100%"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg></div>
                    </div>
                </div>
            </div>
        `
        const elem = CommonFunction.createElementsFromHTML(html)[0]
        // 折り畳みボタン押下時、次の区切りまでの要素を非表示にする
        elem.querySelector('.ysc-divider-minimizer').addEventListener('click', () => {
            const subscriptionsItemObjects = this.getSubscriptionsItemObjects()
            const myDividerIdx = subscriptionsItemObjects.findIndex(obj => obj.type === 'divider' && obj.elem === elem)
            // ボタン変更
            elem.querySelector('.ysc-divider-minimizer').style.display = 'none'
            elem.querySelector('.ysc-divider-maximizer').style.display = 'block'
            if (myDividerIdx === subscriptionsItemObjects.length - 1) {
                // この区切り要素が最後の項目だった場合、非表示にする要素は存在しない
                return
            }
            const nextDividerIdx = subscriptionsItemObjects.slice(myDividerIdx + 1).findIndex(obj => obj.type === 'divider') + (myDividerIdx + 1)
            const existsNextDivider = (nextDividerIdx !== myDividerIdx)
            if (existsNextDivider) {
                // 次の区切り要素まで項目を非表示
                for(let i=myDividerIdx+1; i<nextDividerIdx; i++) {
                    subscriptionsItemObjects[i].elem.style.display = 'none'
                }
            }
            else {
                // 次の区切り要素が存在しない場合、残りの項目を全て非表示
                for(let i=myDividerIdx+1; i<subscriptionsItemObjects.length; i++) {
                    subscriptionsItemObjects[i].elem.style.display = 'none'
                }
            }
            this.saveDividerState()
        })
        // 展開ボタン押下時、次の区切りまでの要素を表示する
        elem.querySelector('.ysc-divider-maximizer').addEventListener('click', () => {
            const subscriptionsItemObjects = this.getSubscriptionsItemObjects()
            const myDividerIdx = subscriptionsItemObjects.findIndex(obj => obj.type === 'divider' && obj.elem === elem)
            // ボタン変更
            elem.querySelector('.ysc-divider-minimizer').style.display = 'block'
            elem.querySelector('.ysc-divider-maximizer').style.display = 'none'
            if (myDividerIdx !== subscriptionsItemObjects.length - 1) {  // この区切り要素が一番下野要素の場合は処理しない
                const nextDividerIdx = subscriptionsItemObjects.slice(myDividerIdx + 1).findIndex(obj => obj.type === 'divider') + (myDividerIdx + 1)
                const existsNextDivider = (nextDividerIdx !== myDividerIdx)
                if (existsNextDivider) {
                    for(let i=myDividerIdx+1; i<nextDividerIdx; i++) {
                        subscriptionsItemObjects[i].elem.style.display = 'block'
                    }
                }
                else {
                    for(let i=myDividerIdx+1; i<subscriptionsItemObjects.length; i++) {
                        subscriptionsItemObjects[i].elem.style.display = 'block'
                    }
                }
            }
            this.saveDividerState()
        })
        // バツボタン押下時、区切り要素を削除
        elem.querySelector('.ysc-divider-remover').addEventListener('click', () => {
            // 折り畳み中の場合、非表示の登録チャンネル項目要素を表示
            const subscriptionsItemObjects = this.getSubscriptionsItemObjects()
            const myDividerIdx = subscriptionsItemObjects.findIndex(obj => obj.type === 'divider' && obj.elem === elem)
            if (myDividerIdx !== subscriptionsItemObjects.length - 1) {
                const nextDividerIdx = subscriptionsItemObjects.slice(myDividerIdx + 1).findIndex(obj => obj.type === 'divider') + (myDividerIdx + 1)
                const existsNextDivider = (nextDividerIdx !== myDividerIdx)
                if (existsNextDivider) {
                    for(let i=myDividerIdx+1; i<nextDividerIdx; i++) {
                        subscriptionsItemObjects[i].elem.style.display = 'block'
                    }
                }
                else {
                    for(let i=myDividerIdx+1; i<subscriptionsItemObjects.length; i++) {
                        subscriptionsItemObjects[i].elem.style.display = 'block'
                    }
                }
            }
            elem.remove()
            this.saveSortedSubscriptionsItemIds()
        })
        return elem
    }

    // 登録チャンネル項目要素の並び替えを実行
    async execSubscriptionsSorting() {
        if (await this.existsSortedChannelIds() == false) return
        const subscriptionsItemsElem = this.getSubscriptionsItemsElem()
        const sortedSubscriptionsItemObjects = await this.getSortedSubscriptionsItemObjects()
        // 保存済みの順番で登録チャンネル項目要素を常時表示部分に表示
        sortedSubscriptionsItemObjects.forEach(itemObject => {
            if (itemObject.type === 'channel') {
                // 登録チャンネル項目要素を追加（移動）
                subscriptionsItemsElem.insertAdjacentElement('beforeend', itemObject.elem)
            }
            else if (itemObject.type === 'divider') {
                // 区切り要素を作成・追加
                subscriptionsItemsElem.insertAdjacentElement('beforeend', this.generateDividerElem(itemObject.title))
            }
        })
        // 拡張部分の位置を移動
        const expandedElem = this.getExpandedElem()
        if (expandedElem != null) {
            subscriptionsItemsElem.insertAdjacentElement('beforeend', expandedElem)
        }
        // チャンネル一覧リンクの位置を移動
        const channelExpandedItemsContainerElem = this.getSubscriptionsElem().querySelector('div#expandable-items')
        const channelListLinkElem = this.getSubscriptionsElem().querySelector('a#endpoint[title="チャンネル一覧"]').parentElement
        if (channelExpandedItemsContainerElem != null) {
            channelExpandedItemsContainerElem.insertAdjacentElement('beforeend', channelListLinkElem)
        }
        else { // 登録チャンネルが7件未満で全表示・折り畳み要素が存在しない場合
            subscriptionsItemsElem.insertAdjacentElement('beforeend', channelListLinkElem)
        }
    }

    // D&D並び替え機能の設定
    sortableSetting() {
        const selectedClassName = 'ysc-streaming-item-selected'
        const filterdClassName = 'ysc-sortable-filtered'
        // 全表示・折り畳み要素をSortableJSの対象外に設定
        const expandedElem = this.getExpandedElem()
        if (expandedElem != null) {
            expandedElem.classList.add(filterdClassName)
        }
        // チャンネル一覧ボタン要素をSortableJSの対象外に設定
        const channelListElem = document.evaluate('//yt-formatted-string[contains(text(), "チャンネル一覧")]/../../..', this.getSubscriptionsItemsElem(), null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotItem(0)
        channelListElem.classList.add(filterdClassName)
        // 登録チャンネル項目要素にD&D並び替え機能を付与
        let followerItems = []
        const subscriptionsItemsElem = this.getSubscriptionsItemsElem()
        new Sortable(subscriptionsItemsElem, {
            animation: 100,
            group: 'shared',
            filter: '.' + filterdClassName,
            multiDrag: true,
            multiDragKey: 'ctrl',
            selectedClass: selectedClassName,
            onMove: evt => {
                const isNotFiltered = (evt.related.className.includes(filterdClassName) === false)
                return isNotFiltered  // true:移動, false:移動しない
            },
            onStart: evt => {
                followerItems = []
                const elem = Array.from(subscriptionsItemsElem.children)[evt.oldIndex];
                // 区切り要素で折り畳み中の場合、次の区切りまでに存在する登録チャンネル項目要素を取得しておく
                if (elem.classList.contains('ysc-divider')) {
                    if (window.getComputedStyle(elem.getElementsByClassName('ysc-divider-minimizer')[0]).display === 'none') {
                        const subscriptionsItemObjects = this.getSubscriptionsItemObjects()
                        const myDividerIdx = evt.oldIndex
                        if (myDividerIdx !== subscriptionsItemObjects.length - 1) {
                            const nextDividerIdx = subscriptionsItemObjects.slice(myDividerIdx + 1).findIndex(obj => obj.type === 'divider') + (myDividerIdx + 1)
                            const existsNextDivider = (nextDividerIdx !== myDividerIdx)
                            if (existsNextDivider) {
                                for(let i=myDividerIdx+1; i<nextDividerIdx; i++) {
                                    followerItems.push(subscriptionsItemObjects[i].elem)
                                }
                            }
                            else {
                                for(let i=myDividerIdx+1; i<subscriptionsItemObjects.length; i++) {
                                    followerItems.push(subscriptionsItemObjects[i].elem)
                                }
                            }
                        }
                    }
                }
            },
            onEnd: evt => {
                // 区切り要素で折り畳み中の場合、取得しておいた登録チャンネル項目要素を移動後の区切り要素の下に移動する
                const elem = evt.item
                if (evt.oldIndex !== evt.newIndex) {
                    // 移動先の下に非表示中の登録チャンネル項目要素が存在する場合、その後に移動する
                    let nextElem = elem.nextElementSibling
                    while (nextElem !== null && window.getComputedStyle(nextElem).display === 'none') {
                        nextElem = nextElem.nextElementSibling
                    }
                    nextElem.insertAdjacentElement('beforebegin', elem)
                    // 取得しておいた登録チャンネル項目要素を移動後の区切り要素の下に移動する
                    if (elem.classList.contains('ysc-divider')) {
                        if (window.getComputedStyle(elem.getElementsByClassName('ysc-divider-minimizer')[0]).display === 'none') {
                            let targetElem = elem
                            if (followerItems.length > 0) {
                                followerItems.forEach(followerItem => {
                                    targetElem.insertAdjacentElement('afterend', followerItem)
                                    targetElem = followerItem
                                })
                            }
                            followerItems = []
                        }
                    }
                }

                this.saveSortedSubscriptionsItemIds()
            }
        })
        // 登録チャンネル欄の項目要素の複数選択処理の設定
        subscriptionsItemsElem.addEventListener('click', (event) => {
            if (event.ctrlKey) {
                // ctrlキー押下＋左クリックで新しいウィンドウを開かないように
                event.preventDefault()
            }
            else {
                // Ctrlなしの場合、選択を解除（通常クリックでも選択されてしまうため）
                const selectedItemElems = document.getElementsByClassName(selectedClassName)
                Array.from(selectedItemElems).forEach(elem => Sortable.utils.deselect(elem))
            }
        })
    }

    // 区切り要素の状態を再現
    async reproduceDividerState() {
        if (await this.existsDividerState() === false) return
        const dividerState = await this.loadDividerState()
        const dividerElems = this.getSubscriptionsItemsElem().querySelectorAll('.ysc-divider')
        Array.from(dividerElems).forEach(elem => {
            const dividerTitle = elem.querySelector('.ysc-divider-name').innerText
            const idx = dividerState.findIndex(obj => obj.title === dividerTitle)
            if (idx !== -1) {
                if (dividerState[idx].isMaxmized === false) {
                    elem.getElementsByClassName('ysc-divider-minimizer')[0].click()
                }
            }
            dividerState.splice(idx, 1)
        })
    }

    // 折り畳みボタンを削除
    removeCollapserElem() {
        this.getSubscriptionsElem().querySelector('#collapser-item').remove()
    }

    // 配信中チャンネル情報を取得する
    getStreamingChannelsMap() {
        let channelsMap = new Map()
        const streamingChannelElems = this.getSubscriptionsItemsElem().querySelectorAll('ytd-guide-entry-renderer[line-end-style="badge"]')
        Array.from(streamingChannelElems).forEach(elem => {
            const aElem = elem.querySelector('a#endpoint')
            const imgElem = aElem.querySelector('yt-icon.guide-icon').getAttribute('disable-upgrade')
            if (imgElem != null) {
                channelsMap.set(aElem.getAttribute('href'), new Map([
                    ['name', aElem.getAttribute('title')],
                    ['img', imgElem.match(/"url":"(.+?)"/)[1]]
                ]))
            }
        })
        return channelsMap
    }

    // 配信中チャンネル要素を作成・表示
    createStreamingChannelsElem() {
        const channelSectionElem = this.getSubscriptionsElem()
        channelSectionElem.insertAdjacentHTML('beforebegin', `
            <ytd-guide-section-renderer id="streaming-channel" class="style-scope ytd-guide-renderer" guide-persistent-and-visible="">
            </ytd-guide-section-renderer>
        `)
        const streamingChannelSectionElem = document.getElementById('streaming-channel')
        streamingChannelSectionElem.querySelector('h3 yt-formatted-string').innerText = '配信中チャンネル'

        const streamingChannelsMap = this.getStreamingChannelsMap()
        streamingChannelsMap.forEach((v, k) => {
            streamingChannelSectionElem.querySelector('#items').insertAdjacentHTML('beforeend', `
                <div class="ysc-streaming-item" remote-click="${k}">
                    <img class="ysc-streaming-item-img" src="${v.get('img')}"/>
                    <div class="ysc-streaming-item-name">${v.get('name')}</div>
                    <div class="ysc-streaming-item-icon"><svg viewBox="0 0 16 16" preserveAspectRatio="xMidYMid meet" focusable="false" class="style-scope yt-icon" style="pointer-events: none; display: block; width: 100%; height: 100%;"><g class="style-scope yt-icon"><path d="M9 8.00004C9 8.55004 8.55 9.00004 8 9.00004C7.45 9.00004 7 8.55004 7 8.00004C7 7.45004 7.45 7.00004 8 7.00004C8.55 7.00004 9 7.45004 9 8.00004ZM10.11 10.13L10.82 10.84C11.55 10.11 12 9.11004 12 8.00004C12 6.89004 11.55 5.89004 10.82 5.16004L10.11 5.87004C10.66 6.42004 11 7.17004 11 8.00004C11 8.83004 10.66 9.58004 10.11 10.13ZM5.18 10.84L5.89 10.13C5.34 9.58004 5 8.83004 5 8.00004C5 7.17004 5.34 6.42004 5.89 5.87004L5.18 5.16004C4.45 5.89004 4 6.89004 4 8.00004C4 9.11004 4.45 10.11 5.18 10.84ZM12.23 12.25L12.94 12.96C14.21 11.69 15 9.94004 15 8.00004C15 6.06004 14.21 4.31004 12.94 3.04004L12.23 3.75004C13.32 4.84004 14 6.34004 14 8.00004C14 9.66004 13.32 11.16 12.23 12.25ZM3.06 12.96L3.77 12.25C2.68 11.16 2 9.66004 2 8.00004C2 6.34004 2.68 4.84004 3.77 3.75004L3.06 3.04004C1.79 4.31004 1 6.06004 1 8.00004C1 9.94004 1.79 11.69 3.06 12.96Z" class="style-scope yt-icon"></path></g></svg></div>
                </div>
            `)
            document.querySelector(`[remote-click="${k}"]`).addEventListener('click', () => {
                document.querySelector(`a[href="${k}"]`).click()
            })
        })
    }

    // 登録チャンネルにメニューを追加
    createSubscriptionMenuElem() {
        // 区切り入力欄要素の作成・追加
        const subscriptionsItemsElem = this.getSubscriptionsItemsElem()
        subscriptionsItemsElem.insertAdjacentHTML('beforebegin', `
            <div id="ysc-js-divider_generator" class="ysc-divider_generator" style="display:none;">
                <input id="ysc-js-divider_generator-input" class="ysc-divider_generator-input" value="">
                <button id="ysc-js-divider_generator-button" class="ysc-divider_generator-button">追加</button>
            </div>
        `)
        // 入力欄表示トグル要素の追加
        const h3Elem = this.getSubscriptionsElem().querySelector('h3')
        h3Elem.style.display = 'flex'
        h3Elem.style.justifyContent = 'space-between'
        h3Elem.style.alignItems = 'center'
        h3Elem.insertAdjacentHTML('beforeend', `
            <div id="ysc-js-subscription-menu-opener" class="ysc-subscriptions-menu-opener" title="区切り追加">
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="style-scope yt-icon" style="pointer-events: none; display: block; width: 100%; height: 100%;"><g class="style-scope yt-icon"><path d="M22,13h-4v4h-2v-4h-4v-2h4V7h2v4h4V13z M14,7H2v1h12V7z M2,12h8v-1H2V12z M2,16h8v-1H2V16z" class="style-scope yt-icon"></path></g></svg>
            </div>
        `)
        // 入力欄表示トグル押下時、入力欄の表示を切り替える
        const openerElem = document.getElementById('ysc-js-subscription-menu-opener')
        openerElem.addEventListener('click', () => {
            const dividerGeneratorElem = document.getElementById('ysc-js-divider_generator')
            if (dividerGeneratorElem.style.display === 'none') {
                dividerGeneratorElem.style.display = 'flex'
                const inputElem = document.getElementById('ysc-js-divider_generator-input')
                inputElem.focus()
            }
            else {
                dividerGeneratorElem.style.display = 'none'
            }
        })
        // 追加ボタン押下時、区切り要素を追加
        const dividerGeneratorButtonElem = document.getElementById('ysc-js-divider_generator-button')
        dividerGeneratorButtonElem.addEventListener('click', () => {
            const inputElem = document.getElementById('ysc-js-divider_generator-input')
            const dividerTitle = inputElem.value
            if (dividerTitle !== '') {
                subscriptionsItemsElem.insertAdjacentElement('afterbegin', this.generateDividerElem(dividerTitle))
            }
            this.saveSortedSubscriptionsItemIds()
            inputElem.value = ''
        })
    }

    // メインメソッド
    async main() {
        // 登録チャンネル要素の出現を待機
        await this.waitForLoadSubscriptionsElem()

        // 登録チャンネルの並び替え処理
        await this.showAllSubscriptionsItems()
        await this.execSubscriptionsSorting()
        this.sortableSetting()
        await this.reproduceDividerState()
        this.removeCollapserElem()

        // 配信中チャンネル要素の作成・表示
        this.createStreamingChannelsElem()

        // 登録チャンネルにメニューを追加
        this.createSubscriptionMenuElem()
    }
}

(async () => {
    const youtubeSortChannel = new YoutubeSortChannel()
    await youtubeSortChannel.main()
})()
