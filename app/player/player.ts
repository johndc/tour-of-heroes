import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { skillMapFromFactory,
    SkillMapOf,
    SkillMap,
    SkillType,
    zeroSkillMap,
    getTruthySkills
} from '../core/index';
import { LiveSkill } from './skill';
import { Skill, RawSkill } from './skill.interface';

import { GLOBALS } from '../globals';
import { Player, RawPlayer } from './player.interface'

export class LivePlayer implements Player {
    level$: BehaviorSubject<number>;
    constructor(
        public name: string,
        // Starts from 1 (unlike skills)
        public level: number,
        public klass: string,
        private _skills: SkillMapOf<LiveSkill>
    ) {
        this._totalSkillLevels = 0;
        // TODO: Possible to use only the subject, and not even need level ivar?
        this.level$ = new BehaviorSubject<number>(level);
    }

    get skills() : SkillMapOf<Skill> {
        return this._skills;
    }

    static newborn(name: string, klass:string, aptitudes: SkillMap) {
        return new LivePlayer(name, 1, klass,
                             LivePlayer.newbornSkills(aptitudes)
                            );
    }
    static newbornSkills(aptitudes: SkillMap) {
        return skillMapFromFactory<LiveSkill>(
            (s: SkillType) => {
                return new LiveSkill(s, SkillType[s], 0, aptitudes[s], 0);
            }
        );
    }

    static fromJSON(raw: RawPlayer) : LivePlayer {
        return new LivePlayer(
            raw.name,
            raw.level,
            raw.klass,
            raw.skills.map( (skill: RawSkill) => LiveSkill.fromJSON(skill) )
        );
    }

    toJSON() : RawPlayer {
        return {
            name: this.name,
            klass: this.klass,
            level: this.level,
            skills: this._skills.map( (skill: LiveSkill) => skill.toJSON() )
        };
    }

    private _totalSkillLevels: number;
    get totalSkillLevels() { return this._totalSkillLevels; }
    set totalSkillLevels(newValue: number) {
        let thresh = this.skillLevelsForNextLevel();
        while (newValue >= thresh) {
            this.level$.next(this.level++);
            newValue -= thresh;
            thresh = this.skillLevelsForNextLevel();
        }
        this._totalSkillLevels = newValue;
    }

    baseSkillLevels(): SkillMap {
        return this.skills.map( (s: Skill) => {
            return s.baseLevel;
        });
    }

    progress() {
        return {numerator: this.totalSkillLevels,
            denominator: this.skillLevelsForNextLevel()};
    }

    applySkillPoints(points: SkillMap) : SkillMap {
        let gains: SkillMap = zeroSkillMap();
        for (let skill of getTruthySkills(points)) {
            let delta = this._skills[skill].train(points[skill]);
            gains[skill] = delta.pointsGained;
            this.totalSkillLevels += delta.levelsGained;
        }
        return gains;
    }

    buffAptitudes(by: SkillMap) {
        for (let skill of getTruthySkills(by)) {
            this._skills[skill].aptitudeBonus += by[skill];
        }
    }

    skillLevelsForNextLevel() : number {
        return LivePlayer.skillLevelsForNextLevel(this.level);
    }

    static skillLevelsForNextLevel(level: number) : number {
        return GLOBALS.playerLevelIncrement * level;
    }
}