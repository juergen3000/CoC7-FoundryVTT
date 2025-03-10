/* global canvas, ChatMessage, CONST, Dialog, game, getDocumentClass, Hooks, Macro, Roll, ui */

import { COC7 } from './config.js'
import { CoC7Check } from './check.js'
import { CoC7Item } from './items/item.js'
import { RollDialog } from './apps/roll-dialog.js'
import { chatHelper } from './chat/helper.js'

export class CoC7Utilities {
  // static test(event){
  //   if( event.shiftKey) ui.notifications.info('Hello from SHIFT utilities');
  //   else ui.notifications.info('Hello from utilities');
  //   const speaker = ChatMessage.getSpeaker();
  //   let actor;
  //   if (speaker.token) actor = game.actors.tokens[speaker.token];
  //   if (!actor) actor = game.actors.get(speaker.actor);

  //  actor.setCondition(COC7.status.criticalWounds);
  // }

  static isFormula (x) {
    if (typeof x !== 'string') return false
    if (!isNaN(Number(x))) return false
    return Roll.validate(x)
  }

  static ParseChatEntry (html, content) {
    const regX = /(\S+)/g
    const terms = content.match(regX)
    if (
      terms[0]?.toLowerCase().match(/^\/r(oll)?$/) &&
      terms[1]?.toLowerCase().startsWith('1d%')
    ) {
      // Delay calling function to prevent chatmessage key down triggering default
      setTimeout(function () {
        CoC7Utilities._ExecCommand(content)
      }, 200)
      return false
    }
  }

  static async _ExecCommand (content) {
    const options = content
      .toLowerCase()
      .split(' ')
      ?.join('')
      ?.replace(/\/r(oll)?1d%/, '')
    const check = new CoC7Check()
    if (options.length) {
      let escaped = options
      let threshold
      let difficulty = CoC7Check.difficultyLevel.regular
      let diceModifier = 0
      let ask = false
      let flatDiceModifier
      let flatThresholdModifier
      const thresholdStr = escaped.match(/[^(]+(?=\))/)
      if (thresholdStr && thresholdStr.length) {
        threshold = Number(thresholdStr[0])
        for (const match of thresholdStr) {
          escaped = escaped.replace(`(${match})`, '')
        }
      }
      const difficultyStr = escaped.match(/[^[]+(?=\])/)
      if (difficultyStr && difficultyStr.length) {
        difficulty = CoC7Utilities.convertDifficulty(difficultyStr[0])
        for (const match of difficultyStr) {
          escaped = escaped.replace(`[${match}]`, '')
        }
      }
      if (escaped.includes('?')) {
        ask = true
        escaped = escaped.replace('?', '')
      }
      if (!isNaN(Number(escaped))) diceModifier = Number(escaped)

      if (ask) {
        const dialogOptions = {
          threshold: threshold,
          modifier: diceModifier,
          difficulty: difficulty,
          askValue: true
        }
        const usage = await RollDialog.create(dialogOptions)
        if (usage) {
          diceModifier = Number(usage.get('bonusDice'))
          difficulty = Number(usage.get('difficulty'))
          threshold = Number(usage.get('threshold')) || threshold
          flatDiceModifier = Number(usage.get('flatDiceModifier'))
          flatThresholdModifier = Number(usage.get('flatThresholdModifier'))
        }
      }

      check.diceModifier = diceModifier || 0
      check.difficulty = difficulty || CoC7Check.difficultyLevel.regular
      check.rawValue = threshold
      check.flatDiceModifier = flatDiceModifier
      check.flatThresholdModifier = flatThresholdModifier
      if (threshold) check.rawValue = !isNaN(threshold) ? threshold : undefined
    }
    const speaker = ChatMessage.getSpeaker()
    if (speaker.token && speaker.scene) {
      const actor = chatHelper.getActorFromKey(
        `${speaker.scene}.${speaker.token}`
      ) // REFACTORING (2) +++ why speaker.scene.
      if (actor) check.actor = actor
    } else if (speaker.actor) {
      const actor = game.actors.get(speaker.actor)
      if (actor) check.actor = actor
    }
    await check.roll()
    check.toMessage()
  }

  static async test () {
    ui.notifications.infos('Do some stuff')
  }

  static getCreatureSanData (creature) {
    let creatureData
    let actor
    if (creature.constructor.name === 'CoCActor') {
      actor = creature
    }

    if (typeof creature === 'string') {
      actor = CoC7Utilities.getActorFromString(creature)
    }

    if (actor) {
      if (actor.isToken) {
        const specie = game.actors.get(actor.id)
        // The token has a different maximum san loss.
        // We assume it's a special represantant of his specie.
        // The san loss for encoutered creature will counted for that token in particular
        // and for the all specie
        if (specie && specie.sanLossMax !== actor.sanLossMax) {
          creatureData = {
            id: actor.token.id,
            name: actor.name,
            sanLossMax: actor.sanLossMax,
            specie: {
              id: specie.id,
              name: specie.name,
              sanLossMax: specie.sanLossMax
            }
          }
        } else {
          // If they induce the same SAN loos credit everything to the specie.
          // If the actor doen't exist in actor directory use the token data instead.
          creatureData = {
            id: specie ? specie.id : actor.id,
            name: specie ? specie.name : actor.name,
            sanLossMax: specie ? specie.sanLossMax : actor.sanLossMax
          }
        }
      } else {
        creatureData = {
          id: actor.id,
          name: actor.name,
          sanLossMax: actor.sanLossMax
        }
      }
      return creatureData
    } else if (typeof creature === 'object') return creature
    return null
  }

  static getActorFromString (actorString) {
    let actor

    // Token is better than actor.
    // Case 1 : trying with ID.
    // Case 1.1 : token found.
    if (game.actors.tokens[actorString]) return game.actors.tokens[actorString]
    // Case 1.2 : actor found.
    actor = game.actors.get(actorString)
    if (actor) return actor

    // Case 2 : trying with name
    // Case 2.1 : token found.
    actor = Object.values(game.actors.tokens).find(t => {
      if (t.name.toLowerCase() === actorString.toLowerCase()) return true
      return false
    })
    if (!actor) {
      // Case 2.2 : actor found.
      actor = game.actors.find(a => {
        if (a.name.toLowerCase() === actorString.toLowerCase()) return true
        return false
      })
    }
    if (actor) return actor

    // // Case 3 string maybe an actorKey
    // if (creature.includes('.')) {
    //   const [, actorId] = key.split('.')
    //   return CoC7Utilities.getActorFromString(actorId)
    // }

    // No joy
    return null
  }

  static getCharacteristicNames (char) {
    const charKey = char.toLowerCase()

    switch (charKey) {
      case 'str':
        return {
          short: game.i18n.localize('CHARAC.STR'),
          label: game.i18n.localize('CHARAC.Strength')
        }
      case 'con':
        return {
          short: game.i18n.localize('CHARAC.CON'),
          label: game.i18n.localize('CHARAC.Constitution')
        }
      case 'siz':
        return {
          short: game.i18n.localize('CHARAC.SIZ'),
          label: game.i18n.localize('CHARAC.Size')
        }
      case 'dex':
        return {
          short: game.i18n.localize('CHARAC.DEX'),
          label: game.i18n.localize('CHARAC.Dexterity')
        }
      case 'app':
        return {
          short: game.i18n.localize('CHARAC.APP'),
          label: game.i18n.localize('CHARAC.Appearance')
        }
      case 'int':
        return {
          short: game.i18n.localize('CHARAC.INT'),
          label: game.i18n.localize('CHARAC.Intelligence')
        }
      case 'pow':
        return {
          short: game.i18n.localize('CHARAC.POW'),
          label: game.i18n.localize('CHARAC.Power')
        }
      case 'edu':
        return {
          short: game.i18n.localize('CHARAC.EDU'),
          label: game.i18n.localize('CHARAC.Education')
        }
      default: {
        for (const [, value] of Object.entries(
          game.system.template.Actor.templates.characteristics.characteristics
        )) {
          if (charKey === game.i18n.localize(value.short).toLowerCase()) {
            return {
              short: game.i18n.localize(value.short),
              label: game.i18n.localize(value.label)
            }
          }
        }
        return null
      }
    }
  }

  static convertDifficulty (difficulty) {
    if (String(difficulty) === '0') return CoC7Check.difficultyLevel.regular
    if (typeof difficulty !== 'string') return difficulty
    if (!isNaN(Number(difficulty))) return Number(difficulty)

    switch (difficulty) {
      case '?':
        return CoC7Check.difficultyLevel.unknown
      case '+':
        return CoC7Check.difficultyLevel.hard
      case '++':
        return CoC7Check.difficultyLevel.extreme
      case '+++':
        return CoC7Check.difficultyLevel.critical
      default:
        return CoC7Check.difficultyLevel.regular
    }
  }

  static skillCheckMacro (skill, event, options = {}) {
    event.preventDefault()
    const speaker = ChatMessage.getSpeaker()
    let actor
    if (speaker.token) actor = game.actors.tokens[speaker.token]
    if (!actor) actor = game.actors.get(speaker.actor) // No need to fill actor token

    if (!actor) {
      ui.notifications.warn(game.i18n.localize('CoC7.WarnNoActorAvailable'))
      return
    }

    actor.skillCheck(skill, event.shiftKey, options)
  }

  static weaponCheckMacro (weapon, event) {
    event.preventDefault()
    const speaker = ChatMessage.getSpeaker()
    let actor
    if (speaker.token) actor = game.actors.tokens[speaker.token]
    if (!actor) {
      if (speaker.scene && speaker.token) {
        // Create a synthetic actor linked with the active token.
        const baseActor = game.actors.get(speaker.actor)
        const scene = game.scenes.get(speaker.scene)
        const token = scene.tokens.get(speaker.token)

        const ActorClass = getDocumentClass('Actor')
        const tokenActor = new ActorClass(baseActor.toJSON(), {
          parent: token
        })
        actor = tokenActor
      } else actor = game.actors.get(speaker.actor)
    }

    if (!actor) {
      ui.notifications.warn(game.i18n.localize('CoC7.WarnNoActorAvailable'))
      return
    }

    actor.weaponCheck(weapon, event.shiftKey)
  }

  static async checkMacro (threshold = undefined, event = null) {
    await CoC7Utilities.rollDice(event, { threshold: threshold })
  }

  static async createMacro (bar, data, slot) {
    if (data.type !== 'Item') return

    let item
    let origin
    let packName = null

    if (data.pack) {
      const pack = game.packs.get(data.pack)
      if (pack.metadata.entity !== 'Item') return
      packName = data.pack
      item = await pack.getDocument(data.id)
      origin = 'pack'
    } else if (data.data) {
      item = data.data
      origin = 'actor'
    } else {
      item = game.items.get(data.id)
      origin = 'game'
    }

    if (!item) {
      return ui.notifications.warn(
        game.i18n.localize('CoC7.WarnMacroNoItemFound')
      )
    }
    if (!(item.type === 'weapon') && !(item.type === 'skill')) {
      return ui.notifications.warn(
        game.i18n.localize('CoC7.WarnMacroIncorrectType')
      )
    }

    let command

    if (item.type === 'weapon') {
      command = `game.CoC7.macros.weaponCheck({name:'${item.name}', id:'${item.id}', origin:'${origin}', pack: '${packName}'}, event);`
    }

    if (item.type === 'skill') {
      if (CoC7Item.isAnySpec(item)) {
        return ui.notifications.warn(
          game.i18n.localize('CoC7.WarnNoGlobalSpec')
        )
      }
      command = `game.CoC7.macros.skillCheck({name:'${item.name}', id:'${item.id}', origin:'${origin}', pack: '${packName}'}, event);`
    }

    // Create the macro command
    let macro = game.macros.contents.find(
      m => m.name === item.name && m.command === command
    )
    if (!macro) {
      macro = await Macro.create({
        name: item.name,
        type: 'script',
        img: item.img,
        command: command
      })
    }
    game.user.assignHotbarMacro(macro, slot)
    return false
  }

  static async toggleDevPhase (toggle) {
    await game.settings.set('CoC7', 'developmentEnabled', toggle)
    ui.notifications.info(
      toggle
        ? game.i18n.localize('CoC7.DevPhaseEnabled')
        : game.i18n.localize('CoC7.DevPhaseDisabled')
    )
    game.socket.emit('system.CoC7', {
      type: 'updateChar'
    })
    CoC7Utilities.updateCharSheets()
  }

  static async toggleCharCreation (toggle) {
    await game.settings.set('CoC7', 'charCreationEnabled', toggle)
    ui.notifications.info(
      toggle
        ? game.i18n.localize('CoC7.CharCreationEnabled')
        : game.i18n.localize('CoC7.CharCreationDisabled')
    )
    game.socket.emit('system.CoC7', {
      type: 'updateChar'
    })
    CoC7Utilities.updateCharSheets()
    Hooks.call('toggleCharCreation', toggle)
  }

  static async getTarget () {
    const users = game.users.filter(user => user.active)
    const actors = game.actors
    let checkOptions = `<input type="checkbox" name="COCCheckAllPC" id="COCCheckAllPC">\n
    <label for="COCCheckAllPC">${game.i18n.localize('CoC7.allActors')}</label>`
    const playerTokenIds = users
      .map(u => u.character?.id)
      .filter(id => id !== undefined)
    const selectedPlayerIds = canvas.tokens.controlled.map(token => {
      return token.actor.id
    })

    // Build checkbox list for all active players
    actors.forEach(actor => {
      const checked =
        (selectedPlayerIds.includes(actor.id) ||
          playerTokenIds.includes(actor.id)) &&
        'checked'
      checkOptions += `
     <br>
     <input type="checkbox" name="${actor.id}" id="${actor.id}" value="${actor.name}" ${checked}>\n
     <label for="${actor.id}">${actor.name}</label>
       `
    })

    new Dialog({
      title: `${game.i18n.localize('CoC7.dreaming')}`,
      content: `${game.i18n.localize(
        'CoC7.restTargets'
      )}: ${checkOptions} <br>`,
      buttons: {
        whisper: {
          label: `${game.i18n.localize('CoC7.startRest')}`,
          callback: async html => {
            const targets = []
            let all = false
            const users = html.find('[type="checkbox"]')
            for (const user of users) {
              if (user.name === 'COCCheckAllPC' && user.checked) all = true
              if (user.checked || all) targets.push(user.id)
            }
            await CoC7Utilities.startRest(targets)
          }
        }
      }
    }).render(true)
  }

  static async startRest (targets) {
    if (!targets.length) return
    const actors = game.actors.filter(actor => targets.includes(actor.id))
    let chatContent = `<i>${game.i18n.localize('CoC7.dreaming')}...</i><br>`
    for (const actor of actors) {
      if (['character', 'npc', 'creature'].includes(actor.type)) {
        let quickHealer = false
        for (const item of actor.data.items) {
          if (item.type === 'talent') {
            if (item.name === `${game.i18n.localize('CoC7.quickHealer')}`) {
              quickHealer = true
            }
          }
        }
        const isCriticalWounds = actor.hasCondition(COC7.status.criticalWounds)
        const dailySanityLoss = actor.data.data.attribs.san.dailyLoss
        const hpValue = actor.data.data.attribs.hp.value
        const hpMax = actor.data.data.attribs.hp.max
        const oneFifthSanity =
          ' / ' + Math.floor(actor.data.data.attribs.san.value / 5)
        const mpValue = actor.data.data.attribs.mp.value
        const mpMax = actor.data.data.attribs.mp.max
        const pow = actor.data.data.characteristics.pow.value
        chatContent = chatContent + `<br><b>${actor.name}. </b>`
        if (isCriticalWounds === false && hpValue < hpMax) {
          if (game.settings.get('CoC7', 'pulpRules')) {
            let healAmount = 2
            if (quickHealer === true) {
              healAmount = 3
            }
            healAmount = Math.min(healAmount, hpMax - hpValue)
            chatContent =
              chatContent +
              `<b style="color:darkolivegreen">${game.i18n.format(
                'CoC7.pulpHealthRecovered',
                { number: healAmount }
              )}. </b>`
            actor.update({
              'data.attribs.hp.value':
                actor.data.data.attribs.hp.value + healAmount
            })
          } else {
            chatContent =
              chatContent +
              `<b style="color:darkolivegreen">${game.i18n.localize(
                'CoC7.healthRecovered'
              )}. </b>`
            actor.update({
              'data.attribs.hp.value': actor.data.data.attribs.hp.value + 1
            })
          }
        } else if (isCriticalWounds === true && hpValue < hpMax) {
          chatContent =
            chatContent +
            `<b style="color:darkred">${game.i18n.localize(
              'CoC7.hasCriticalWounds'
            )}. </b>`
        }
        if (dailySanityLoss > 0) {
          chatContent =
            chatContent +
            `<b style="color:darkolivegreen">${game.i18n.localize(
              'CoC7.dailySanLossRestarted'
            )}.</b>`
          actor.update({
            'data.attribs.san.dailyLoss': 0,
            'data.attribs.san.oneFifthSanity': oneFifthSanity
          })
        }
        const hours = 7
        if (hours > 0 && mpValue < mpMax) {
          let magicAmount = hours * Math.ceil(pow / 100)
          magicAmount = Math.min(magicAmount, mpMax - mpValue)
          chatContent =
            chatContent +
            `<b style="color:darkolivegreen">${game.i18n.format(
              'CoC7.magicPointsRecovered'
            )}: ${magicAmount}.</b>`
          actor.update({
            'data.attribs.mp.value':
              actor.data.data.attribs.mp.value + magicAmount
          })
        }
      }
    }
    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker(),
      content: chatContent,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    }
    ChatMessage.create(chatData)
  }

  static async toggleXPGain (toggle) {
    await game.settings.set('CoC7', 'xpEnabled', toggle)
    ui.notifications.info(
      toggle
        ? game.i18n.localize('CoC7.XPGainEnabled')
        : game.i18n.localize('CoC7.XPGainDisabled')
    )
  }

  static async rollDice (event, options = {}) {
    options.askValue = !options.threshold
    let diceModifier, difficulty, flatDiceModifier, flatThresholdModifier
    let threshold = options.threshold

    if (undefined !== options.modifier) diceModifier = Number(options.modifier)
    if (undefined !== options.difficulty) {
      difficulty = CoC7Utilities.convertDifficulty(options.difficulty)
    }

    if (!event?.shiftKey && !options.fastForward) {
      const usage = await RollDialog.create(options)
      if (usage) {
        diceModifier = Number(usage.get('bonusDice'))
        difficulty = Number(usage.get('difficulty'))
        threshold = Number(usage.get('threshold'))
        flatDiceModifier = Number(usage.get('flatDiceModifier'))
        flatThresholdModifier = Number(usage.get('flatThresholdModifier'))
      }
    }

    const actors = []

    if (game.user.isGM && canvas.tokens.controlled.length) {
      for (const token of canvas.tokens.controlled) {
        actors.push(token.actor.tokenKey)
      }
    } else if (game.user.character) {
      actors.push(game.user.character.tokenKey)
    }

    for (const tk of actors) {
      const check = new CoC7Check()
      check.diceModifier = diceModifier || 0
      check.difficulty = difficulty || CoC7Check.difficultyLevel.regular
      check.rawValue = threshold
      check.flatDiceModifier = flatDiceModifier
      check.flatThresholdModifier = flatThresholdModifier
      check.actor = tk
      await check.roll()
      check.toMessage()
    }

    if (!actors.length) {
      const check = new CoC7Check()
      check.diceModifier = diceModifier || 0
      check.difficulty = difficulty || CoC7Check.difficultyLevel.regular
      check.rawValue = threshold
      check.flatDiceModifier = flatDiceModifier
      check.flatThresholdModifier = flatThresholdModifier
      await check.roll()
      check.toMessage()
    }
  }

  static updateCharSheets () {
    if (game.user.isGM) {
      for (const a of game.actors.contents) {
        if (a?.data?.type === 'character' && a?.sheet && a?.sheet?.rendered) {
          a.update({ 'data.flags.locked': true })
          a.render(false)
        }
      }
    } else {
      for (const a of game.actors.contents) {
        if (a.isOwner) {
          a.update({ 'data.flags.locked': true })
          a.render(false)
        }
      }
    }
  }

  /**
   * Called from _onDrop to get the dropped entityType or entityType from a folder
   * @param {jQuery} event @see activateListeners
   * @returns [items] array of items
   */
  static async getDataFromDropEvent (event, entityType = 'Item') {
    if (event.originalEvent) return []
    try {
      const dataList = JSON.parse(event.dataTransfer.getData('text/plain'))
      if (dataList.type === 'Folder' && dataList.documentName === entityType) {
        const folder = game.folders.get(dataList.id)
        if (!folder) return []
        return folder.contents
      } else if (dataList.type === entityType) {
        if (dataList.pack) {
          const pack = game.packs.get(dataList.pack)
          if (pack.metadata.entity !== entityType) return []
          return [await pack.getDocument(dataList.id)]
        } else if (dataList.data) {
          return [dataList]
        } else {
          return [game.items.get(dataList.id)]
        }
      } else {
        return []
      }
    } catch (err) {
      return []
    }
  }

  static async copyToClipboard (text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999px'
        textArea.style.top = '-999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        return new Promise((resolve, reject) => {
          document.execCommand('copy')
            ? resolve()
            : reject(
              new Error(game.i18n.localize('CoC7.UnableToCopyToClipboard'))
            )
          textArea.remove()
        }).catch(err => ui.notifications.error(err))
      }
    } catch (err) {
      ui.notifications.error(game.i18n.localize('CoC7.UnableToCopyToClipboard'))
    }
  }

  static quoteRegExp (string) {
    // https://bitbucket.org/cggaertner/js-hacks/raw/master/quote.js
    const len = string.length
    let qString = ''

    for (let current, i = 0; i < len; ++i) {
      current = string.charAt(i)

      if (current >= ' ' && current <= '~') {
        if (current === '\\' || current === "'") {
          qString += '\\'
        }

        qString += current.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
      } else {
        switch (current) {
          case '\b':
            qString += '\\b'
            break

          case '\f':
            qString += '\\f'
            break

          case '\n':
            qString += '\\n'
            break

          case '\r':
            qString += '\\r'
            break

          case '\t':
            qString += '\\t'
            break

          case '\v':
            qString += '\\v'
            break

          default:
            qString += '\\u'
            current = current.charCodeAt(0).toString(16)
            for (let j = 4; --j >= current.length; qString += '0');
            qString += current
        }
      }
    }

    return qString
  }
}
