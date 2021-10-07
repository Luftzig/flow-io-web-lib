/**
 * A small implementation of a publisher-subscriber pattern.
 * @constructor (topics: string[], shouldThrow = false) - specifies the list of subscribable topics.
 * Trying to subscribe to a topic not specified during construction will throw an exception if `shouldThrow` is true.
 * Otherwise, failures are silent.
 * Listeners should avoid throwing exception.
 */
export class Subscription<EventData> {
  #listeners: { [topic: string]: Array<(data: EventData) => void> } = {}
  #shouldThrow

  constructor(topics: string[], shouldThrow = false) {
    this.#listeners = Object.fromEntries(topics.map(ev => [ev, []]))
    this.#shouldThrow = shouldThrow
  }

  /**
   * @return {string[]} List of legal topics. Topic list is immutable.
   */
  topics() {
    return Object.keys(this.#listeners)
  }

  /**
   * Subscribe to a topic with a listener
   * @param topic
   * @param listener
   */
  subscribe(topic: string, listener: (data: EventData) => void) {
    if (this.#listeners[topic] != null) {
      this.#listeners[topic].push(listener)
    } else if (this.#shouldThrow) {
      throw new Error(`Unrecognised topic ${topic}. Supported topics are: ${Object.keys(this.#listeners)}`)
    }
  }

  /**
   * Unsubscribe a listener from a topic. Listener must be identical to the one being unsubscribed.
   * @param topic
   * @param listener
   */
  unsubscribe(topic: string, listener: (data: EventData) => void) {
    if (this.#listeners[topic] != null) {
      this.#listeners[topic] = this.#listeners[topic].filter(registered => registered !== listener)
    } else if (this.#shouldThrow) {
      throw new Error(`Unrecognised topic ${topic}. Supported topics are: ${Object.keys(this.#listeners)}`)
    }
  }

  /**
   * Publish to a topic
   * @param topic
   * @param data
   */
  publish(topic: string, data: EventData) {
    if (this.#listeners[topic] != null) {
      this.#listeners[topic].forEach(callback => callback(data))
    } else if (this.#shouldThrow) {
      throw new Error(`Unrecognised topic ${topic}. Supported topics are: ${Object.keys(this.#listeners)}`)
    }
  }
}