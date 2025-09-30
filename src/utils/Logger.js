#!/usr/bin/env node

import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * 설정 기반 로거 유틸리티
 *
 * api-generator.config.json의 logging 섹션을 기반으로
 * 콘솔 로그 레벨과 형식을 제어합니다.
 */
class Logger {
	constructor() {
		this.config = this.loadLoggingConfig()
		this.currentLevel = this.config.level || 'info'
		this.enabled = this.config.enabled !== false
		this.showTimestamp = this.config.showTimestamp || false
		this.showEmoji = this.config.showEmoji !== false
	}

	/**
	 * 로깅 설정 로드
	 */
	loadLoggingConfig() {
		try {
			const configPath = join(process.cwd(), 'scripts/api/api-generator.config.json')
			const configContent = readFileSync(configPath, 'utf8')
			const config = JSON.parse(configContent)
			return config.logging || {}
		} catch (error) {
			// 설정 파일 로드 실패 시 기본 설정 사용
			return {
				level: 'info',
				enabled: true,
				showTimestamp: false,
				showEmoji: true,
				levels: {
					debug: 0,
					info: 1,
					success: 2,
					warn: 3,
					error: 4,
					silent: 5,
				},
				colors: {
					debug: { emoji: '🔍', color: 'gray' },
					info: { emoji: '📋', color: 'blue' },
					success: { emoji: '✅', color: 'green' },
					warn: { emoji: '⚠️', color: 'yellow' },
					error: { emoji: '❌', color: 'red' },
				},
			}
		}
	}

	/**
	 * 로그 레벨이 출력 가능한지 확인 (토글 방식 + 우선순위)
	 * 우선순위: all > none > 개별설정
	 * all과 none이 둘 다 true면 all이 승리
	 */
	shouldLog(level, category = null) {
		if (!this.enabled) return false

		const levels = this.config.levels || {}

		// 1순위: all이 true면 모든 로그 출력 (none보다 우선)
		if (levels.all === true) {
			return true
		}

		// 2순위: none이 true면 모든 로그 차단
		if (levels.none === true) {
			return false
		}

		// 3순위: 개별 레벨 설정 확인
		const isLevelEnabled = levels[level] === true

		// 카테고리별 설정이 있다면 추가 확인
		if (category && this.config.categories && this.config.categories[category]) {
			const categoryLevel = this.config.categories[category]
			const isCategoryEnabled = levels[categoryLevel] === true
			return isCategoryEnabled
		}

		return isLevelEnabled
	}

	/**
	 * 타임스탬프 생성
	 */
	getTimestamp() {
		if (!this.showTimestamp) return ''
		return `[${new Date().toISOString()}] `
	}

	/**
	 * 이모지 및 색상 정보 가져오기
	 */
	getLogStyle(level) {
		const colorInfo = this.config.colors?.[level] || {}
		const emoji = this.showEmoji ? colorInfo.emoji || '' : ''
		return { emoji, color: colorInfo.color || 'white' }
	}

	/**
	 * 실제 로그 출력
	 */
	log(level, message, category = null, ...args) {
		if (!this.shouldLog(level, category)) return

		const timestamp = this.getTimestamp()
		const { emoji } = this.getLogStyle(level)
		const prefix = emoji ? `${emoji} ` : ''

		// 카테고리 표시
		const categoryPrefix = category ? `[${category.toUpperCase()}] ` : ''

		const fullMessage = `${timestamp}${prefix}${categoryPrefix}${message}`

		// 로그 레벨에 따른 콘솔 메서드 선택
		switch (level) {
			case 'error':
				console.error(fullMessage, ...args)
				break
			case 'warn':
				console.warn(fullMessage, ...args)
				break
			case 'debug':
				console.debug(fullMessage, ...args)
				break
			default:
				console.log(fullMessage, ...args)
		}
	}

	/**
	 * 편의 메서드들
	 */
	debug(message, category = null, ...args) {
		this.log('debug', message, category, ...args)
	}

	info(message, category = null, ...args) {
		this.log('info', message, category, ...args)
	}

	success(message, category = null, ...args) {
		this.log('success', message, category, ...args)
	}

	warn(message, category = null, ...args) {
		this.log('warn', message, category, ...args)
	}

	error(message, category = null, ...args) {
		this.log('error', message, category, ...args)
	}

	/**
	 * 로그 레벨 동적 변경
	 */
	setLevel(level) {
		this.currentLevel = level
	}

	/**
	 * 로깅 활성화/비활성화
	 */
	setEnabled(enabled) {
		this.enabled = enabled
	}

	/**
	 * 구분선 출력
	 */
	separator(char = '─', length = 60) {
		if (this.shouldLog('info')) {
			console.log(char.repeat(length))
		}
	}

	/**
	 * 그룹 시작
	 */
	group(title, level = 'info') {
		if (this.shouldLog(level)) {
			const { emoji } = this.getLogStyle(level)
			console.group(`${emoji} ${title}`)
		}
	}

	/**
	 * 그룹 종료
	 */
	groupEnd() {
		if (this.enabled) {
			console.groupEnd()
		}
	}

	/**
	 * 진행률 표시
	 */
	progress(current, total, message = '진행중') {
		if (this.shouldLog('info')) {
			const percentage = Math.round((current / total) * 100)
			const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5))
			this.info(`${message}: [${progressBar}] ${percentage}% (${current}/${total})`)
		}
	}
}

// 싱글톤 인스턴스 생성
const logger = new Logger()

export default logger
