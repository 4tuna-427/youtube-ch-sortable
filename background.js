'use strict'

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({'url': 'options.html' })
})
