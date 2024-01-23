import logging
from time import sleep
from random import random

def funC(n):
    logging.debug("funC{}: begin".format(n))
    if n == 0:
        logging.debug("funC{}: end".format(n))
        return
    sleep(random() / 1000)
    for i in range(2):
        funC(n-1)
    logging.debug("funC{}: end".format(n))

def funB():
    logging.debug("funB: begin")
    sleep(random() / 100)
    for i in range(3):
        funC(random()*4 // 1)
    logging.debug("funB: end")


def funA():
    logging.debug("funA: begin")
    for i in range(10):
        if random() < .2:
            sleep(0.01)
        else:
            funB()
    logging.debug("funA: end")

def runMockProgram():
    logging.debug( "start program" )
    logging.debug( "start program" )
    for i in range(10):
        funA()
        sleep(random() / 10)


if __name__ == "__main__":
    logging.basicConfig(filename='example.log',
                        encoding='utf-8',
                        format='%(asctime)s.%(msecs)03d - t0x%(thread)d [Debug] %(message)s',
                        datefmt='%Y-%m-%d %H:%M:%S',
                        level=logging.DEBUG)
    runMockProgram()