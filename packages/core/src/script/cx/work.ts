import { message } from '../../components/utils';
import { domSearch, elementToRawObject, sleep, waitForRecognize } from '../../core/utils';
import { OCSWorker } from '../../core/worker';
import { defaultAnswerWrapperHandler } from '../../core/worker/answer.wrapper.handler';
import { logger } from '../../logger';
import { useSettings, useStore } from '../../store';
import { StringUtils } from '@ocsjs/common/src/utils/string';

export async function workOrExam(
  type: 'work' | 'exam' = 'work'
) {
  const { period, timeout, retry, upload, waitForCheck } = useSettings().cx.work;
  const { answererWrappers } = useSettings().common;

  if (upload === 'close') {
    logger('warn', '自动答题已被关闭！');
    message('warn', '自动答题已被关闭！请在设置开启自动答题！或者忽略此警告');
  } else if (answererWrappers.length === 0) {
    logger('warn', '题库配置为空，请设置。');
  } else {
    const local = useStore('localStorage');
    /** 清空内容 */
    local.workResults = [];

    // 等待文字识别
    await waitForRecognize('cx');

    /** 新建答题器 */
    const worker = new OCSWorker({
      root: '.questionLi',
      elements: {
        title: 'h3',
        options: '.answerBg .answer_p, .textDIV, .eidtDiv',
        type: type === 'exam' ? 'input[name^="type"]' : 'input[id^="answertype"]'
      },
      /** 默认搜题方法构造器 */
      answerer: (elements, type, ctx) => {
        const title: string = StringUtils.nowrap(elements.title[0].textContent || elements.title[0].innerText)
          .trim()
          .replace(/\(..题, .+?分\)/, '')
          .replace(/[[|(|【|（]..题[\]|)|】|）]/, '')
          .replace(/^\d+\.?/, '')
          .trim();

        if (title) {
          return defaultAnswerWrapperHandler(answererWrappers, { type, title, root: ctx.root });
        } else {
          throw new Error('题目为空，请查看题目是否为空，或者忽略此题');
        }
      },

      work: {
        /**
         * cx 题目类型 ：
         * 0 单选题
         * 1 多选题
         * 2 简答题
         * 3 判断题
         * 4 填空题
         */
        type({ elements }) {
          const typeInput = elements.type[0] as HTMLInputElement;
          const type = parseInt(typeInput.value);
          return type === 0
            ? 'single'
            : type === 1
              ? 'multiple'
              : type === 2
                ? 'completion'
                : type === 3
                  ? 'judgement'
                  : type === 4
                    ? 'completion'
                    : undefined;
        },
        /** 自定义处理器 */
        handler(type, answer, option) {
          if (type === 'judgement' || type === 'single' || type === 'multiple') {
            if (option.parentElement?.querySelector('.check_answer,.check_answer_dx') === null) {
              option.click();
            }
          } else if (type === 'completion' && answer.trim()) {
            const text = option.querySelector('textarea');
            const textareaFrame = option.querySelector('iframe');
            if (text) {
              text.value = answer;
            }
            if (textareaFrame?.contentDocument) {
              textareaFrame.contentDocument.body.innerHTML = answer;
            }
          }
        }
      },
      onElementSearched(elements) {
        // 处理题目跨域丢失问题
        elements.title = elements.title.map(elementToRawObject);
      },
      /** 完成答题后 */
      onResult: (res) => {
        if (res.ctx) {
          local.workResults.push(res);
        }
        console.log(res);
        logger('info', '题目完成结果 : ', res.result?.finish ? '完成' : '未完成');
      },

      /** 其余配置 */

      period: (period || 3) * 1000,
      timeout: (timeout || 30) * 1000,
      retry,
      stopWhenError: false
    });

    const results = await worker.doWork();

    logger('info', '做题完毕', results);

    if (type === 'exam') {
      logger('info', '为了安全考虑，请自行检查后自行点击提交！');
    } else {
      // 处理提交
      await worker.uploadHandler({
        uploadRate: upload,
        results,
        async callback(finishedRate, uploadable) {
          logger('info', '完成率 : ', finishedRate, ' , ', uploadable ? '5秒后将自动提交' : '5秒后将自动保存');

          await sleep(5000);
          if (uploadable) {
            //  提交
            domSearch({ submit: '.completeBtn' }).submit?.click();
            await sleep(2000);
            // @ts-ignore 确定
            // eslint-disable-next-line no-undef
            submitWork();
          } else {
            // @ts-ignore 暂时保存
            // eslint-disable-next-line no-undef
            saveWork();
          }
        }
      });
    }
  }

  if (waitForCheck) {
    logger('debug', `正在等待答题检查: 一共 ${waitForCheck} 秒`);
    await sleep(waitForCheck * 1000);
  }
}
