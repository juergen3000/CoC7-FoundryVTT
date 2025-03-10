/* global game, ItemSheet, mergeObject */

import { COC7 } from '../../config.js'
import { CoCActor } from '../../actors/actor.js'

/**
 * Extend the basic ItemSheet with some very simple modifications
 */
export class CoC7WeaponSheet extends ItemSheet {
  /**
   *
   */
  static get defaultOptions () {
    return mergeObject(super.defaultOptions, {
      classes: ['coc7', 'sheet', 'item'],
      width: 520,
      height: 480,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'skills'
        }
      ]
    })
  }

  /**
   *
   */
  get template () {
    const path = 'systems/CoC7/templates/items'
    return `${path}/weapon-sheet.html`
  }

  /**
   * Prepare data for rendering the Item sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  getData () {
    const data = super.getData()
    data.dtypes = ['String', 'Number', 'Boolean']
    /** MODIF 0.8.x */
    const itemData = data.data
    data.data = itemData.data // MODIF: 0.8.x data.data
    /** MODIF 0.8.x */

    data.hasOwner = this.item.actor != null
    if (data.hasOwner) data.actorKey = this.item.actor.actorKey

    data.combatSkill = []
    if (data.hasOwner) {
      data.firearmSkills = this.actor.firearmSkills
      data.fightingSkills = this.actor.fightingSkills
      data.combatSkill = this.item.actor.items.filter(item => {
        if (item.type === 'skill') {
          if (item.data.data.properties.combat) {
            return true
          }
        }
        return false
      })

      data.combatSkill.sort((a, b) => {
        let lca
        let lcb
        if (a.data.properties && b.data.properties) {
          lca = a.data.properties.special
            ? a.data.specialization.toLowerCase() + a.name.toLowerCase()
            : a.name.toLowerCase()
          lcb = b.data.properties.special
            ? b.data.specialization.toLowerCase() + b.name.toLowerCase()
            : b.name.toLowerCase()
        } else {
          lca = a.name.toLowerCase()
          lcb = b.name.toLowerCase()
        }
        return lca.localeCompare(lcb)
      })
    }

    data._properties = []
    for (const [key, value] of Object.entries(COC7.weaponProperties)) {
      const property = {}
      property.id = key
      property.name = value
      property.isEnabled = this.item.data.data.properties[key] === true
      data._properties.push(property)
    }

    if (!this.item.data.data.price) this.item.data.data.price = {}

    data._eras = []
    for (const [key, value] of Object.entries(COC7.eras)) {
      const era = {}
      if (!this.item.data.data.price[key]) this.item.data.data.price[key] = 0
      era.price = this.item.data.data.price[key]
      era.id = key
      era.name = value
      era.isEnabled = this.item.data.data.eras[key] === true
      data._eras.push(era)
    }
    data.usesAlternateSkill =
      this.item.data.data.properties.auto === true ||
      this.item.data.data.properties.brst === true ||
      this.item.data.data.properties.thrown === true

    data.isKeeper = game.user.isGM
    return data
  }

  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners (html) {
    super.activateListeners(html)

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return
    html.find('.toggle-switch').click(this._onClickToggle.bind(this))
    html.find('.weapon-property').click(this._onPropertyClick.bind(this))
  }

  /**
   *
   * @param {*} event
   */
  async _onClickToggle (event) {
    event.preventDefault()
    const propertyId =
      event.currentTarget.closest('.toggle-switch').dataset.property
    await this.item.toggleProperty(
      propertyId,
      event.metaKey ||
        event.ctrlKey ||
        event.keyCode === 91 ||
        event.keyCode === 224
    )
  }

  async _onPropertyClick (event) {
    event.preventDefault()
    const property =
      event.currentTarget.closest('.weapon-property').dataset.property
    const weaponId = event.currentTarget.closest('.weapon').dataset.itemId
    const actorKey = event.currentTarget.closest('.weapon').dataset.actorKey
    let weapon = null
    if (actorKey) {
      const actor = CoCActor.getActorFromKey(actorKey)
      weapon = actor.items.get(weaponId)
    } else {
      weapon = game.items.get(weaponId)
    }
    await weapon.toggleProperty(property)
  }
}
