'use strict';

(async () => {
    const getDateTime = () => {
        const now = new Date()
        const y = now.getFullYear()
        const m = ('0' + (now.getMonth() + 1)).slice(-2)
        const d = ('0' + now.getDate()).slice(-2)
        const h = ('0' + now.getHours()).slice(-2)
        const i = ('0' + now.getMinutes()).slice(-2)
        const s = ('0' + now.getSeconds()).slice(-2)
        const str = y + m + d + h + i + s
        return str
    }

    const downloadTextFile = (text, fileName) => {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8"' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName + '.txt'
        link.click()
    }

    const importButtonElem = document.getElementById('sequence-import')
    importButtonElem.addEventListener('click', async () => {
        const [fileHandle] = await window.showOpenFilePicker()
        const fileData = await fileHandle.getFile()
        console.log(fileData)

        const fileReader = new FileReader()
        fileReader.readAsText(fileData)

        fileReader.onload = async () => {
            const channelIds = fileReader.result.split('\n')
            await chrome.storage.local.set({ 'sorted_subscriptions_item_ids': channelIds })
            const msgCompletedImportElem = document.getElementById('msg-completed-import')
            msgCompletedImportElem.style.display = 'inline'
            setTimeout(() => {
                msgCompletedImportElem.style.display = 'none'
            }, 3000)
        }
    })

    const exportButtonElem = document.getElementById('sequence-export')
    exportButtonElem.addEventListener('click', async () => {
        await chrome.storage.local.get('sorted_subscriptions_item_ids', v => {
            const channelIds = v.sorted_subscriptions_item_ids
            if (typeof channelIds === 'undefined') return
            const text = channelIds.join('\n')
            const timestamp = getDateTime()
            downloadTextFile(text, `youtube-sort-ch-export-${timestamp}`)
        })
    })
})()
